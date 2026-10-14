import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** Limita e conta os bytes de um stream; falha com 413 se ultrapassar o máximo. */
class ByteLimiter extends Transform {
  bytes = 0;
  constructor(private readonly maxBytes: number) {
    super();
  }
  _transform(chunk: Buffer, _enc: BufferEncoding, cb: (err?: Error, data?: Buffer) => void) {
    this.bytes += chunk.length;
    if (this.bytes > this.maxBytes) {
      cb(new PayloadTooLargeException(`Ficheiro excede o limite de ${Math.round(this.maxBytes / 1048576)} MB.`));
      return;
    }
    cb(undefined, chunk);
  }
}

/**
 * Armazenamento de ficheiros carregados (importações).
 * - `local`: disco do servidor. Para desenvolvimento ou uma única instância.
 * - `s3`: AWS S3, Cloudflare R2, MinIO... Necessário com várias instâncias e permite
 *   upload direto do browser (URL pré-assinado), sem o ficheiro passar pela API.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly driver: 'local' | 's3';
  private readonly root: string;
  private readonly s3?: S3Client;
  private readonly bucket?: string;

  constructor(config: ConfigService) {
    this.driver = config.get('STORAGE_DRIVER') as 'local' | 's3';
    this.root = resolve(config.get<string>('STORAGE_LOCAL_DIR'));
    if (this.driver === 's3') {
      this.bucket = config.get('S3_BUCKET');
      this.s3 = new S3Client({
        region: config.get('S3_REGION'),
        endpoint: config.get('S3_ENDPOINT') || undefined,
        forcePathStyle: config.get('S3_FORCE_PATH_STYLE') === 'true',
        credentials: {
          accessKeyId: config.get('S3_ACCESS_KEY_ID'),
          secretAccessKey: config.get('S3_SECRET_ACCESS_KEY'),
        },
      });
    }
  }

  get supportsDirectUpload() {
    return this.driver === 's3';
  }

  /** Grava um stream, sem o carregar para memória. Devolve o tamanho em bytes. */
  async write(key: string, body: Readable, maxBytes: number): Promise<number> {
    const limiter = new ByteLimiter(maxBytes);
    try {
      if (this.s3) {
        const upload = new Upload({
          client: this.s3,
          params: { Bucket: this.bucket, Key: key, Body: body.pipe(limiter) },
          queueSize: 4,
          partSize: 8 * 1024 * 1024,
        });
        body.on('error', (e) => limiter.destroy(e));
        await upload.done();
      } else {
        const path = this.localPath(key);
        await mkdir(dirname(path), { recursive: true });
        await pipeline(body, limiter, createWriteStream(path));
      }
      return limiter.bytes;
    } catch (e) {
      await this.delete(key);
      throw e;
    }
  }

  async read(key: string): Promise<Readable> {
    if (this.s3) {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return res.Body as Readable;
    }
    return createReadStream(this.localPath(key), { highWaterMark: 1024 * 1024 });
  }

  /** Tamanho em bytes, ou `null` se o ficheiro não existir. */
  async size(key: string): Promise<number | null> {
    try {
      if (this.s3) {
        const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
        return head.ContentLength ?? 0;
      }
      return (await stat(this.localPath(key))).size;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.s3) await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      else await rm(this.localPath(key), { force: true });
    } catch (e) {
      this.logger.warn(`Não foi possível apagar ${key}: ${(e as Error).message}`);
    }
  }

  /** URL para o browser enviar o ficheiro diretamente para o S3/R2 (PUT). */
  async presignUpload(key: string, contentType: string, expiresInSeconds = 3600): Promise<string> {
    if (!this.s3) throw new Error('Upload direto só está disponível com STORAGE_DRIVER=s3.');
    return getSignedUrl(this.s3, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: expiresInSeconds,
    });
  }

  private localPath(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error('Chave de armazenamento inválida.');
    return path;
  }
}
