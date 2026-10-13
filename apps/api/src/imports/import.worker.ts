import {
  HttpException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatasetStatus, ImportJob, ImportKind, JobStatus, Prisma } from '@prisma/client';
import { PgService } from '../database/pg.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { copyRowsIntoDataset } from './dataset-importer.js';
import { importOutletRows } from './outlet-importer.js';
import { readSpreadsheetRows } from './spreadsheet-reader.js';

const POLL_MS = 2000;
const HEARTBEAT_MS = 20_000;
/** Um job "em processamento" sem sinal de vida há mais do que isto é retomado por outra instância. */
const STALE_SECONDS = 120;
const MAX_ATTEMPTS = 3;

class JobCancelledError extends Error {}

/**
 * Processa importações em segundo plano, fora do pedido HTTP.
 * Seguro com várias instâncias da API: cada job é reservado com `FOR UPDATE SKIP LOCKED`,
 * e um job cuja instância morreu (sem heartbeat) é retomado automaticamente.
 */
@Injectable()
export class ImportWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ImportWorker.name);
  private readonly enabled: boolean;
  private readonly concurrency: number;
  private readonly maxRows: number;
  private running = 0;
  private ticking = false;
  private stopped = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pg: PgService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.enabled = config.get('IMPORT_WORKER_ENABLED') !== 'false';
    this.concurrency = Number(config.get('IMPORT_CONCURRENCY'));
    this.maxRows = Number(config.get('IMPORT_MAX_ROWS'));
  }

  onApplicationBootstrap() {
    if (!this.enabled) return;
    this.timer = setInterval(() => this.kick(), POLL_MS);
    this.timer.unref();
    this.kick();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  /** Procura trabalho imediatamente (chamado quando um job novo é criado nesta instância). */
  kick() {
    if (!this.enabled || this.stopped) return;
    setImmediate(() => void this.tick());
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      while (!this.stopped && this.running < this.concurrency) {
        const job = await this.claim();
        if (!job) break;
        this.running++;
        void this.process(job).finally(() => {
          this.running--;
          this.kick();
        });
      }
    } catch (e) {
      this.logger.error(`Erro ao procurar importações: ${(e as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  private async claim(): Promise<ImportJob | null> {
    // As colunas são "timestamp sem fuso" em UTC (convenção do Prisma), daí o AT TIME ZONE 'UTC'.
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE import_jobs
         SET status = 'PROCESSING',
             attempts = attempts + 1,
             "heartbeatAt" = now() AT TIME ZONE 'UTC',
             "startedAt" = COALESCE("startedAt", now() AT TIME ZONE 'UTC')
       WHERE id = (
         SELECT id FROM import_jobs
          WHERE status = 'QUEUED'
             OR (status = 'PROCESSING'
                 AND "heartbeatAt" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${STALE_SECONDS}))
          ORDER BY "createdAt"
          LIMIT 1
          FOR UPDATE SKIP LOCKED)
      RETURNING id`;
    if (!rows.length) return null;
    return this.prisma.importJob.findUnique({ where: { id: rows[0].id } });
  }

  private async process(job: ImportJob) {
    if (job.attempts > MAX_ATTEMPTS) {
      // Foi retomado várias vezes depois de a instância morrer (ex.: falta de memória): desiste.
      if (job.datasetId) await this.prisma.dataset.deleteMany({ where: { id: job.datasetId, status: DatasetStatus.PROCESSING } });
      await this.finish(job, { status: JobStatus.FAILED, error: job.error ?? 'Interrompido repetidamente.' });
      return;
    }
    const started = Date.now();
    const heartbeat = setInterval(() => {
      this.prisma.importJob
        .update({ where: { id: job.id }, data: { heartbeatAt: new Date() } })
        .catch(() => undefined);
    }, HEARTBEAT_MS);
    heartbeat.unref();

    let datasetId: string | null = null;
    try {
      // Retoma de uma tentativa interrompida: descarta o dataset incompleto anterior.
      if (job.datasetId) await this.prisma.dataset.deleteMany({ where: { id: job.datasetId, status: DatasetStatus.PROCESSING } });

      const onProgress = async (rowsProcessed: number) => {
        const current = await this.prisma.importJob.update({
          where: { id: job.id },
          data: { rowsProcessed, heartbeatAt: new Date() },
          select: { cancelRequested: true },
        });
        if (current.cancelRequested || this.stopped) throw new JobCancelledError();
      };
      const rows = readSpreadsheetRows(await this.storage.read(job.storageKey), job.fileName, {
        sheetName: job.sheetName ?? undefined,
      });

      if (job.kind === ImportKind.DATASET) {
        const dataset = await this.prisma.dataset.create({
          data: {
            name: job.targetName ?? job.fileName.replace(/\.[^.]+$/, ''),
            projectId: job.projectId,
            schema: {},
            status: DatasetStatus.PROCESSING,
          },
        });
        datasetId = dataset.id;
        await this.prisma.importJob.update({ where: { id: job.id }, data: { datasetId } });
        const result = await copyRowsIntoDataset(this.pg.pool, {
          datasetId,
          submittedById: job.createdById,
          rows,
          maxRows: this.maxRows,
          onProgress,
        });
        await this.finish(job, { status: JobStatus.COMPLETED, rowsProcessed: result.rowCount });
      } else {
        const result = await importOutletRows(this.prisma, {
          projectId: job.projectId,
          userId: job.createdById,
          rows,
          maxRows: this.maxRows,
          onProgress,
        });
        // Estatísticas atualizadas após carga em massa (ver dataset-importer).
        await this.prisma.$executeRawUnsafe('ANALYZE outlets').catch(() => undefined);
        await this.finish(job, {
          status: JobStatus.COMPLETED,
          rowsProcessed: result.imported,
          rowsFailed: result.skipped,
          rowErrors: result.errors as unknown as Prisma.InputJsonArray,
        });
      }
      this.logger.log(`Importação ${job.id} concluída em ${Math.round((Date.now() - started) / 1000)}s`);
    } catch (e) {
      if (datasetId) await this.prisma.dataset.delete({ where: { id: datasetId } }).catch(() => undefined);

      if (e instanceof JobCancelledError && this.stopped) {
        // A instância está a encerrar: o job será retomado por outra (sem heartbeat).
        return;
      }
      if (e instanceof JobCancelledError) {
        await this.finish(job, { status: JobStatus.CANCELLED, error: 'Cancelado pelo utilizador.' });
        return;
      }
      const dbError = permanentDbError(e);
      const message = e instanceof HttpException ? messageOf(e) : (dbError ?? (e as Error).message);
      // Erros nos dados (ficheiro inválido, sem cabeçalho...) ou espaço esgotado não melhoram com nova
      // tentativa: repetir só voltaria a enviar o ficheiro inteiro para a base de dados.
      const permanent = e instanceof HttpException || dbError !== null;
      if (!permanent && job.attempts < MAX_ATTEMPTS) {
        this.logger.warn(`Importação ${job.id} falhou (tentativa ${job.attempts}), vai repetir: ${message}`);
        await this.prisma.importJob.update({
          where: { id: job.id },
          data: { status: JobStatus.QUEUED, error: message, datasetId: null },
        });
        return;
      }
      this.logger.warn(`Importação ${job.id} falhou: ${message}`);
      await this.finish(job, { status: JobStatus.FAILED, error: message });
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async finish(job: ImportJob, data: Prisma.ImportJobUpdateInput) {
    await this.prisma.importJob.update({ where: { id: job.id }, data: { ...data, finishedAt: new Date() } });
    // O ficheiro original já não é necessário (os dados estão na base de dados).
    await this.storage.delete(job.storageKey);
  }
}

/**
 * Erros do PostgreSQL que não desaparecem ao repetir a importação. Devolve a mensagem a mostrar,
 * ou null se o erro pode ser temporário (rede, base de dados a reiniciar...) e vale a pena repetir.
 */
export function permanentDbError(e: unknown): string | null {
  const err = e as { code?: unknown; message?: unknown };
  const code = typeof err?.code === 'string' ? err.code : '';
  const detail = typeof err?.message === 'string' ? err.message : '';
  // 53100 = disk_full. Na Neon: "could not extend file because project size limit (… MB) has been exceeded".
  if (code === '53100' || /project size limit/i.test(detail)) {
    return (
      'A base de dados atingiu o limite de armazenamento do plano. Aumente o plano da base de dados ' +
      `(ou liberte espaço) e importe de novo. Detalhe: ${detail}`
    );
  }
  // 22 = dados inválidos, 23 = restrições de integridade, 54 = limites do PostgreSQL excedidos.
  if (/^(22|23|54)/.test(code)) return detail;
  return null;
}

function messageOf(e: HttpException): string {
  const response = e.getResponse();
  if (typeof response === 'string') return response;
  const message = (response as { message?: string | string[] }).message;
  return Array.isArray(message) ? message.join('; ') : (message ?? e.message);
}
