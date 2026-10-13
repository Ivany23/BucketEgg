import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImportJob, ImportKind, JobStatus, Prisma } from '@prisma/client';
import busboy from 'busboy';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { AccessService } from '../common/access.service.js';
import { paginate } from '../common/dto/pagination.dto.js';
import type { AuthUser } from '../common/types.js';
import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import {
  CreateImportFromStorageDto,
  ListImportsQueryDto,
  PresignImportDto,
  UploadImportFieldsDto,
} from './dto/import.dto.js';
import { ImportWorker } from './import.worker.js';
import { formatFromFileName } from './spreadsheet-reader.js';

const CONTENT_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

interface StoredFile {
  key: string;
  fileName: string;
  size: number;
}

@Injectable()
export class ImportsService {
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly storage: StorageService,
    private readonly worker: ImportWorker,
    config: ConfigService,
  ) {
    this.maxBytes = Number(config.get('UPLOAD_MAX_MB')) * 1024 * 1024;
  }

  /**
   * Recebe o ficheiro em streaming (multipart) e grava-o no armazenamento sem o carregar
   * para memória. O processamento acontece depois, no worker. Responde logo com o job.
   */
  async uploadAndQueue(user: AuthUser, req: Request) {
    const orgId = this.access.orgId(user);
    const { fields, file } = await this.receiveMultipart(req, orgId);
    try {
      const dto = plainToInstance(UploadImportFieldsDto, fields);
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      if (errors.length) {
        throw new BadRequestException(errors.flatMap((e) => Object.values(e.constraints ?? {})));
      }
      return await this.createJob(user, dto, file);
    } catch (e) {
      await this.storage.delete(file.key);
      throw e;
    }
  }

  /** Passo 1 do upload direto: URL para o browser enviar o ficheiro diretamente ao S3/R2. */
  async presign(user: AuthUser, dto: PresignImportDto) {
    if (!this.storage.supportsDirectUpload) {
      throw new BadRequestException('Upload direto indisponível (STORAGE_DRIVER=local). Use POST /imports/upload.');
    }
    await this.access.project(user, dto.projectId);
    const fileName = safeFileName(dto.fileName);
    formatFromFileName(fileName);
    this.assertSize(dto.fileSize);
    const key = `imports/${this.access.orgId(user)}/${randomUUID()}/${fileName}`;
    const contentType = CONTENT_TYPES[formatFromFileName(fileName)] ?? 'application/octet-stream';
    const expiresIn = 3600;
    return {
      key,
      uploadUrl: await this.storage.presignUpload(key, contentType, expiresIn),
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresIn,
    };
  }

  /** Passo 2 do upload direto: o ficheiro já está no S3/R2, cria o job de importação. */
  async createFromStorage(user: AuthUser, dto: CreateImportFromStorageDto) {
    const prefix = `imports/${this.access.orgId(user)}/`;
    if (!dto.key.startsWith(prefix)) throw new ForbiddenException('Chave de ficheiro inválida.');
    const size = await this.storage.size(dto.key);
    if (size === null) throw new BadRequestException('O ficheiro ainda não foi enviado para o armazenamento.');
    this.assertSize(size);
    const fileName = dto.key.slice(dto.key.lastIndexOf('/') + 1);
    try {
      return await this.createJob(user, dto, { key: dto.key, fileName, size });
    } catch (e) {
      await this.storage.delete(dto.key);
      throw e;
    }
  }

  async list(user: AuthUser, q: ListImportsQueryDto) {
    const where: Prisma.ImportJobWhereInput = {
      organizationId: this.access.orgId(user),
      projectId: q.projectId,
      status: q.status,
    };
    const [items, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        omit: { rowErrors: true },
      }),
      this.prisma.importJob.count({ where }),
    ]);
    return paginate(items.map(present), total, q);
  }

  async findOne(user: AuthUser, id: string) {
    const job = await this.prisma.importJob.findFirst({ where: { id, organizationId: this.access.orgId(user) } });
    if (!job) throw new NotFoundException('Importação não encontrada.');
    return present(job);
  }

  async cancel(user: AuthUser, id: string) {
    const job = await this.prisma.importJob.findFirst({ where: { id, organizationId: this.access.orgId(user) } });
    if (!job) throw new NotFoundException('Importação não encontrada.');
    if (job.status === JobStatus.QUEUED) {
      // Condicional: o worker pode ter acabado de o reservar.
      const { count } = await this.prisma.importJob.updateMany({
        where: { id, status: JobStatus.QUEUED },
        data: { status: JobStatus.CANCELLED, finishedAt: new Date(), error: 'Cancelado pelo utilizador.' },
      });
      if (count) {
        await this.storage.delete(job.storageKey);
        return this.findOne(user, id);
      }
    }
    const { count } = await this.prisma.importJob.updateMany({
      where: { id, status: JobStatus.PROCESSING },
      data: { cancelRequested: true },
    });
    if (!count) throw new BadRequestException(`A importação já terminou (${job.status}).`);
    return this.findOne(user, id);
  }

  private async createJob(user: AuthUser, dto: UploadImportFieldsDto, file: StoredFile) {
    await this.access.project(user, dto.projectId);
    const kind = dto.kind ?? ImportKind.DATASET;
    if (kind === ImportKind.OUTLETS && !this.access.isManager(user)) {
      throw new ForbiddenException('Só OWNER, ADMIN ou MANAGER podem importar a lista de lojas.');
    }
    if (kind === ImportKind.DATASET && !this.access.canEditData(user)) {
      throw new ForbiddenException('Não tem permissão para importar dados.');
    }
    const job = await this.prisma.importJob.create({
      data: {
        organizationId: this.access.orgId(user),
        projectId: dto.projectId,
        createdById: user.sub,
        kind,
        storageKey: file.key,
        fileName: file.fileName,
        fileSize: BigInt(file.size),
        format: formatFromFileName(file.fileName),
        sheetName: dto.sheetName,
        targetName: dto.name,
      },
    });
    this.worker.kick();
    return present(job);
  }

  private assertSize(size: number) {
    if (size > this.maxBytes) {
      throw new PayloadTooLargeException(`Ficheiro excede o limite de ${Math.round(this.maxBytes / 1048576)} MB.`);
    }
    if (size === 0) throw new BadRequestException('O ficheiro está vazio.');
  }

  private receiveMultipart(req: Request, orgId: string): Promise<{ fields: Record<string, string>; file: StoredFile }> {
    if (!req.headers['content-type']?.startsWith('multipart/form-data')) {
      throw new BadRequestException('Envie o ficheiro como multipart/form-data no campo "file".');
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (e: unknown) => {
        if (settled) return;
        settled = true;
        req.unpipe(bb);
        req.resume(); // descarta o resto do corpo para a resposta de erro chegar ao cliente
        reject(e);
      };
      const fields: Record<string, string> = {};
      let upload: Promise<StoredFile> | null = null;

      let bb: busboy.Busboy;
      try {
        bb = busboy({ headers: req.headers, limits: { files: 1, fields: 10, fieldSize: 1024, fileSize: this.maxBytes + 1 } });
      } catch {
        throw new BadRequestException('Pedido multipart inválido.');
      }
      bb.on('field', (name, value) => {
        fields[name] = value;
      });
      bb.on('file', (name, stream, info) => {
        if (name !== 'file' || upload) {
          stream.resume();
          return;
        }
        const fileName = safeFileName(info.filename ?? '');
        try {
          formatFromFileName(fileName);
        } catch (e) {
          stream.resume();
          fail(e);
          return;
        }
        const key = `imports/${orgId}/${randomUUID()}/${fileName}`;
        upload = this.storage.write(key, stream, this.maxBytes).then((size) => ({ key, fileName, size }));
        upload.catch(fail);
      });
      bb.on('error', () => fail(new BadRequestException('Upload interrompido ou pedido multipart inválido.')));
      bb.on('close', () => {
        if (settled) return;
        if (!upload) {
          fail(new BadRequestException('Envie o ficheiro no campo "file".'));
          return;
        }
        upload.then(
          (file) => {
            if (settled) return;
            settled = true;
            if (file.size === 0) {
              void this.storage.delete(file.key);
              reject(new BadRequestException('O ficheiro está vazio.'));
            } else resolve({ fields, file });
          },
          fail,
        );
      });
      req.on('aborted', () => fail(new BadRequestException('Upload cancelado pelo cliente.')));
      req.pipe(bb);
    });
  }
}

/** Remove caminhos e caracteres problemáticos do nome do ficheiro. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base.replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim().slice(-150);
  return clean || 'ficheiro';
}

function present(job: Omit<ImportJob, 'rowErrors'> & { rowErrors?: unknown }) {
  const { storageKey: _key, ...rest } = job;
  return { ...rest, fileSize: Number(job.fileSize) };
}
