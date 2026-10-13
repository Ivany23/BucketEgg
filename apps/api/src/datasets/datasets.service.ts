import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatasetStatus, Prisma, RevisionAction } from '@prisma/client';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { isDeepStrictEqual } from 'node:util';
import { AccessService } from '../common/access.service.js';
import type { AuthUser } from '../common/types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  CreateFormDto,
  ExportQueryDto,
  FIELD_TYPES,
  FieldDefinitionDto,
  ListRecordsQueryDto,
  SubmitRecordDto,
  UpdateRecordDto,
  UpdateSchemaDto,
} from './dto/dataset.dto.js';

type FieldSchema = Record<string, { originalName?: string; label: string; type: string; active: boolean }>;

const person = { select: { id: true, name: true, email: true } } as const;
/** Linhas lidas da base de dados de cada vez durante a exportação (memória constante). */
const EXPORT_BATCH = 5000;
/** Limite de linhas de uma folha Excel (1 048 576) menos o cabeçalho. */
const XLSX_MAX_ROWS_PER_SHEET = 1_048_575;
/** Fatias do contador de registos submetidos (ver modelo DatasetCounter). */
const COUNTER_SHARDS = 16;

@Injectable()
export class DatasetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Cria um formulário vazio (ex.: auditoria, inquérito) a preencher no terreno. */
  async createForm(user: AuthUser, projectId: string, dto: CreateFormDto) {
    await this.access.project(user, projectId);
    if (!dto.fields.length) throw new BadRequestException('O formulário precisa de pelo menos um campo.');
    const schema: FieldSchema = {};
    dto.fields.forEach((f, i) => {
      schema[`col_${i}`] = { label: f.label, type: f.type ?? 'string', active: f.active ?? true };
    });
    return this.prisma.dataset.create({ data: { name: dto.name, projectId, schema } });
  }

  async getDatasets(user: AuthUser, projectId: string) {
    await this.access.project(user, projectId);
    const select = { id: true, name: true, schema: true, status: true, rowCount: true, createdAt: true };
    if (this.access.canEditData(user)) {
      // rowCount é mantido pela API: evita COUNT(*) em datasets com milhões de linhas.
      const datasets = await this.prisma.dataset.findMany({ where: { projectId }, select, orderBy: { createdAt: 'desc' } });
      const live = await this.submittedCounts(datasets.map((d) => d.id));
      return datasets.map((d) => ({ ...d, rowCount: d.rowCount + (live.get(d.id) ?? 0) }));
    }
    // O auditor vê apenas datasets prontos e quantos registos ele próprio recolheu.
    const datasets = await this.prisma.dataset.findMany({
      where: { projectId, status: DatasetStatus.READY },
      select,
      orderBy: { createdAt: 'desc' },
    });
    if (!datasets.length) return [];
    // Contagem só nos datasets deste projeto, pelo índice (datasetId, submittedById).
    // (O _count do Prisma com filtro percorria a tabela inteira de registos.)
    const mine = await this.prisma.record.groupBy({
      by: ['datasetId'],
      where: { datasetId: { in: datasets.map((d) => d.id) }, submittedById: user.sub, deletedAt: null },
      _count: true,
    });
    const counts = new Map(mine.map((m) => [m.datasetId, m._count]));
    return datasets.map((d) => ({ ...d, rowCount: counts.get(d.id) ?? 0 }));
  }

  /**
   * Registos do dataset. Para datasets grandes use `cursor` (devolvido em `nextCursor`):
   * a paginação por cursor tem custo constante, ao contrário de páginas muito profundas.
   */
  async getDatasetRecords(user: AuthUser, datasetId: string, q: ListRecordsQueryDto) {
    const dataset = await this.findDataset(user, datasetId);
    const canEdit = this.access.canEditData(user);
    if (q.includeDeleted && !canEdit) {
      throw new ForbiddenException('Só supervisores e analistas podem ver registos removidos.');
    }
    const where: Prisma.RecordWhereInput = {
      datasetId,
      ...(q.includeDeleted ? {} : { deletedAt: null }),
      // O auditor só consulta o que ele próprio recolheu.
      ...(canEdit ? {} : { submittedById: user.sub }),
    };
    const useCursor = q.cursor !== undefined;
    const [records, total] = await Promise.all([
      this.prisma.record.findMany({
        where: useCursor ? { ...where, seq: { gt: BigInt(q.cursor) } } : where,
        orderBy: { seq: 'asc' },
        skip: useCursor ? 0 : (q.page - 1) * q.limit,
        take: q.limit,
        include: { submittedBy: person, updatedBy: person, _count: { select: { revisions: true } } },
      }),
      canEdit && !q.includeDeleted
        ? this.submittedCounts([datasetId]).then((live) => dataset.rowCount + (live.get(datasetId) ?? 0))
        : this.prisma.record.count({ where }),
    ]);
    const last = records.at(-1);
    return {
      schema: dataset.schema,
      status: dataset.status,
      canEdit,
      data: records.map((r) => ({
        id: r.id,
        seq: r.seq.toString(),
        data: r.data,
        outletId: r.outletId,
        gpsLat: r.gpsLat,
        gpsLng: r.gpsLng,
        createdAt: r.createdAt,
        submittedBy: r.submittedBy,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
        deletedAt: r.deletedAt,
        revisions: r._count.revisions,
      })),
      meta: {
        total,
        limit: q.limit,
        ...(useCursor ? {} : { page: q.page, pages: Math.ceil(total / q.limit) }),
        nextCursor: records.length === q.limit && last ? last.seq.toString() : null,
      },
    };
  }

  /** Renomeia, oculta ou acrescenta colunas/perguntas sem perder dados existentes. */
  async updateSchema(user: AuthUser, datasetId: string, dto: UpdateSchemaDto) {
    const dataset = await this.findDataset(user, datasetId);
    const schema = { ...(dataset.schema as FieldSchema) };
    for (const [key, field] of Object.entries(dto.fields)) {
      if (!/^[a-zA-Z0-9_]{1,64}$/.test(key)) throw new BadRequestException(`Chave inválida: ${key}`);
      const def = (field ?? {}) as FieldDefinitionDto;
      if (def.label !== undefined && (typeof def.label !== 'string' || !def.label.trim())) {
        throw new BadRequestException(`Label inválido em ${key}.`);
      }
      if (def.type !== undefined && !FIELD_TYPES.includes(def.type)) {
        throw new BadRequestException(`Tipo inválido em ${key}. Use: ${FIELD_TYPES.join(', ')}.`);
      }
      if (def.active !== undefined && typeof def.active !== 'boolean') {
        throw new BadRequestException(`"active" deve ser booleano em ${key}.`);
      }
      if (!schema[key] && !def.label) throw new BadRequestException(`Novo campo ${key} precisa de label.`);
      schema[key] = {
        ...schema[key],
        label: def.label ?? schema[key].label,
        type: def.type ?? schema[key]?.type ?? 'string',
        active: def.active ?? schema[key]?.active ?? true,
      };
    }
    return this.prisma.dataset.update({ where: { id: datasetId }, data: { schema } });
  }

  /** Recolha de dados no terreno. Depois de guardado, o auditor não pode alterar o registo. */
  async submitRecord(user: AuthUser, datasetId: string, dto: SubmitRecordDto) {
    const dataset = await this.findDataset(user, datasetId);
    if (dataset.status !== DatasetStatus.READY) {
      throw new BadRequestException('O dataset ainda está a ser importado ou falhou.');
    }
    this.validateValues(dataset.schema as FieldSchema, dto.data);
    if (dto.outletId) await this.assertOutletInProject(user, dto.outletId, dataset.projectId);
    // Uma única instrução: grava o registo e soma 1 numa fatia ao acaso do contador.
    // Atómico (contagem sempre exata) e sem fila na mesma linha com centenas de auditores.
    const shard = Math.floor(Math.random() * COUNTER_SHARDS);
    const [record] = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      WITH ins AS (
        INSERT INTO records (id, "datasetId", "outletId", data, "gpsLat", "gpsLng", "submittedById", "createdAt")
        VALUES (${randomUUID()}, ${datasetId}, ${dto.outletId ?? null}, ${JSON.stringify(dto.data)}::jsonb,
                ${dto.gpsLat ?? null}, ${dto.gpsLng ?? null}, ${user.sub}, ${new Date().toISOString()}::timestamp)
        RETURNING *
      ), counted AS (
        INSERT INTO dataset_counters ("datasetId", shard, n) VALUES (${datasetId}, ${shard}, 1)
        ON CONFLICT ("datasetId", shard) DO UPDATE SET n = dataset_counters.n + 1
      )
      SELECT * FROM ins`;
    return { ...record, seq: String(record.seq) };
  }

  /**
   * Correção por supervisor/analista. Os campos enviados substituem os existentes,
   * cada alteração fica no histórico e há controlo de concorrência entre vários editores.
   */
  async updateRecord(user: AuthUser, datasetId: string, recordId: string, dto: UpdateRecordDto) {
    this.assertCanEdit(user);
    const dataset = await this.findDataset(user, datasetId);
    if (dto.data) this.validateValues(dataset.schema as FieldSchema, dto.data);
    if (dto.outletId) await this.assertOutletInProject(user, dto.outletId, dataset.projectId);

    const record = await this.findRecord(datasetId, recordId);
    if (record.deletedAt) throw new BadRequestException('O registo foi removido. Restaure-o antes de o editar.');
    this.assertNotStale(record.updatedAt, dto.lastKnownUpdatedAt);

    const previous = { data: record.data, outletId: record.outletId };
    const next = {
      data: { ...(record.data as Record<string, unknown>), ...dto.data },
      outletId: dto.outletId === undefined ? record.outletId : dto.outletId,
    };
    if (isDeepStrictEqual(previous, next)) return this.findRecord(datasetId, recordId);

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      // Atualização condicional: falha se outro editor gravou entre a leitura e a escrita.
      const { count } = await tx.record.updateMany({
        where: { id: recordId, deletedAt: null, updatedAt: record.updatedAt },
        data: {
          data: next.data as Prisma.InputJsonObject,
          outletId: next.outletId,
          updatedAt: now,
          updatedById: user.sub,
        },
      });
      if (!count) throw this.staleError();
      await tx.recordRevision.create({
        data: {
          recordId,
          action: RevisionAction.UPDATE,
          editedById: user.sub,
          previousData: previous as Prisma.InputJsonObject,
          newData: next as Prisma.InputJsonObject,
          reason: dto.reason,
        },
      });
      return tx.record.findUnique({ where: { id: recordId } });
    });
  }

  /** Remoção lógica: o registo sai das listas e exportações mas pode ser restaurado. */
  async deleteRecord(user: AuthUser, datasetId: string, recordId: string, reason?: string) {
    return this.setDeleted(user, datasetId, recordId, true, reason);
  }

  async restoreRecord(user: AuthUser, datasetId: string, recordId: string, reason?: string) {
    return this.setDeleted(user, datasetId, recordId, false, reason);
  }

  async recordHistory(user: AuthUser, datasetId: string, recordId: string) {
    this.assertCanEdit(user);
    await this.findDataset(user, datasetId);
    const record = await this.prisma.record.findFirst({
      where: { id: recordId, datasetId },
      include: {
        submittedBy: person,
        revisions: { orderBy: { createdAt: 'asc' }, include: { editedBy: person } },
      },
    });
    if (!record) throw new NotFoundException('Registo não encontrado.');
    return record;
  }

  async deleteDataset(user: AuthUser, datasetId: string) {
    await this.findDataset(user, datasetId);
    await this.prisma.dataset.delete({ where: { id: datasetId } });
    return { deleted: true };
  }

  /**
   * Exporta o dataset em streaming (XLSX ou CSV): lê da base de dados em lotes e escreve
   * diretamente na resposta, com memória constante mesmo com milhões de linhas.
   * Acima de 1 048 575 linhas o XLSX é dividido em várias folhas (limite do Excel).
   */
  async streamExport(user: AuthUser, datasetId: string, q: ExportQueryDto, res: Response) {
    const dataset = await this.findDataset(user, datasetId);
    if (dataset.status !== DatasetStatus.READY) {
      throw new BadRequestException('O dataset ainda está a ser importado ou falhou.');
    }
    const schema = dataset.schema as FieldSchema;
    const keys = Object.keys(schema).filter((k) => schema[k].active !== false);
    const labels = keys.map((k) => schema[k].label);
    const dateKeys = new Set(keys.filter((k) => schema[k].type === 'date'));
    const format = q.format ?? 'xlsx';

    const fileName = `${dataset.name}.${format}`;
    const ascii = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    res.setHeader(
      'Content-Type',
      format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    const batches = this.recordBatches(datasetId);
    try {
      if (format === 'csv') await this.writeCsv(res, labels, keys, batches, q.delimiter === 'semicolon' ? ';' : ',');
      else await this.writeXlsx(res, labels, keys, dateKeys, batches);
    } catch (e) {
      // Os cabeçalhos já foram enviados: só resta interromper a transferência.
      res.destroy(e as Error);
    }
  }

  private async *recordBatches(datasetId: string) {
    let cursor: bigint | undefined;
    for (;;) {
      const batch = await this.prisma.record.findMany({
        where: { datasetId, deletedAt: null, ...(cursor === undefined ? {} : { seq: { gt: cursor } }) },
        orderBy: { seq: 'asc' },
        take: EXPORT_BATCH,
        select: { seq: true, data: true },
      });
      if (!batch.length) return;
      yield batch.map((r) => r.data as Record<string, unknown>);
      if (batch.length < EXPORT_BATCH) return;
      cursor = batch[batch.length - 1].seq;
    }
  }

  private async writeCsv(
    res: Response,
    labels: string[],
    keys: string[],
    batches: AsyncIterable<Record<string, unknown>[]>,
    delimiter: string,
  ) {
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'string' ? v : String(v);
      return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    // BOM: o Excel abre o CSV com os acentos corretos.
    res.write('\uFEFF' + labels.map(escape).join(delimiter) + '\r\n');
    for await (const rows of batches) {
      let chunk = '';
      for (const data of rows) chunk += keys.map((k) => escape(data[k])).join(delimiter) + '\r\n';
      if (!res.write(chunk)) await once(res, 'drain'); // respeita a velocidade do cliente
    }
    res.end();
  }

  private async writeXlsx(
    res: Response,
    labels: string[],
    keys: string[],
    dateKeys: Set<string>,
    batches: AsyncIterable<Record<string, unknown>[]>,
  ) {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: false, useSharedStrings: false });
    let sheetIndex = 0;
    let rowsInSheet = 0;
    let sheet: ExcelJS.Worksheet | null = null;
    const newSheet = () => {
      sheet?.commit();
      sheetIndex++;
      sheet = workbook.addWorksheet(sheetIndex === 1 ? 'Dados' : `Dados ${sheetIndex}`);
      sheet.addRow(labels).commit();
      rowsInSheet = 0;
    };
    newSheet();
    for await (const rows of batches) {
      for (const data of rows) {
        if (rowsInSheet >= XLSX_MAX_ROWS_PER_SHEET) newSheet();
        sheet.addRow(keys.map((k) => toCell(data[k], dateKeys.has(k)))).commit();
        rowsInSheet++;
      }
      if (res.writableNeedDrain) await once(res, 'drain');
    }
    sheet.commit();
    await workbook.commit();
  }

  private async setDeleted(user: AuthUser, datasetId: string, recordId: string, deleted: boolean, reason?: string) {
    this.assertCanEdit(user);
    await this.findDataset(user, datasetId);
    const record = await this.findRecord(datasetId, recordId);
    if (deleted === !!record.deletedAt) {
      throw new BadRequestException(deleted ? 'O registo já está removido.' : 'O registo não está removido.');
    }
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.record.updateMany({
        where: { id: recordId, deletedAt: record.deletedAt },
        data: deleted ? { deletedAt: new Date(), deletedById: user.sub } : { deletedAt: null, deletedById: null },
      });
      if (!count) throw this.staleError();
      await tx.dataset.update({
        where: { id: datasetId },
        data: { rowCount: deleted ? { decrement: 1 } : { increment: 1 } },
      });
      await tx.recordRevision.create({
        data: {
          recordId,
          action: deleted ? RevisionAction.DELETE : RevisionAction.RESTORE,
          editedById: user.sub,
          previousData: { data: record.data, outletId: record.outletId } as Prisma.InputJsonObject,
          reason,
        },
      });
      return tx.record.findUnique({ where: { id: recordId } });
    });
  }

  /** Garante que o tipo de cada resposta corresponde ao tipo da pergunta. */
  private validateValues(schema: FieldSchema, data: Record<string, unknown>) {
    const errors: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      const field = schema[key];
      if (!field) {
        errors.push(`${key}: campo desconhecido`);
        continue;
      }
      if (field.active === false) {
        errors.push(`${key}: campo desativado`);
        continue;
      }
      if (value === null) continue;
      const ok = (() => {
        switch (field.type) {
          case 'number':
            return typeof value === 'number' && Number.isFinite(value);
          case 'boolean':
            return typeof value === 'boolean';
          case 'date':
            return typeof value === 'string' && !Number.isNaN(Date.parse(value));
          case 'photo':
            return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value);
          case 'select':
            return typeof value === 'string';
          default:
            // 'string': também aceita números/booleanos (comum em dados importados de Excel)
            return ['string', 'number', 'boolean'].includes(typeof value);
        }
      })();
      if (!ok) errors.push(`${key} (${field.label}): esperado ${field.type}`);
    }
    if (errors.length) throw new BadRequestException({ message: 'Dados inválidos.', errors });
  }

  private assertNotStale(current: Date | null, lastKnown?: string | null) {
    if (lastKnown === undefined) return;
    const known = lastKnown === null ? null : new Date(lastKnown).getTime();
    if ((current?.getTime() ?? null) !== known) throw this.staleError();
  }

  private staleError() {
    return new ConflictException(
      'Este registo foi alterado por outro supervisor/analista entretanto. Recarregue e tente novamente.',
    );
  }

  private assertCanEdit(user: AuthUser) {
    if (!this.access.canEditData(user)) {
      throw new ForbiddenException('Os dados recolhidos só podem ser alterados por supervisores ou analistas.');
    }
  }

  private async assertOutletInProject(user: AuthUser, outletId: string, projectId: string) {
    const outlet = await this.access.outlet(user, outletId);
    if (outlet.projectId !== projectId) throw new BadRequestException('A loja não pertence a este projeto.');
  }

  private async findRecord(datasetId: string, recordId: string) {
    const record = await this.prisma.record.findFirst({ where: { id: recordId, datasetId } });
    if (!record) throw new NotFoundException('Registo não encontrado.');
    return record;
  }

  /** Registos submetidos no terreno por dataset (soma das fatias do contador). */
  private async submittedCounts(datasetIds: string[]): Promise<Map<string, number>> {
    if (!datasetIds.length) return new Map();
    const rows = await this.prisma.datasetCounter.groupBy({
      by: ['datasetId'],
      where: { datasetId: { in: datasetIds } },
      _sum: { n: true },
    });
    return new Map(rows.map((r) => [r.datasetId, r._sum.n ?? 0]));
  }

  private async findDataset(user: AuthUser, datasetId: string) {
    const dataset = await this.prisma.dataset.findFirst({
      where: { id: datasetId, project: { organizationId: this.access.orgId(user) } },
    });
    if (!dataset) throw new NotFoundException('Dataset não encontrado.');
    return dataset;
  }
}

/** Converte um valor guardado em JSON para a célula Excel (datas voltam a ser datas). */
function toCell(value: unknown, isDate: boolean): ExcelJS.CellValue {
  if (value === null || value === undefined) return null;
  if (isDate && typeof value === 'string') {
    const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return value as ExcelJS.CellValue;
}
