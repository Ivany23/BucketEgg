import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

/**
 * O driver pg avisa que "sslmode=require" passará a ter a semântica do libpq (sem verificar o
 * certificado). Hoje já verifica; tornamos isso explícito com verify-full (a Neon usa certificados públicos).
 */
export function withVerifiedSsl(url: string): string {
  const u = new URL(url);
  if (['require', 'prefer', 'verify-ca'].includes(u.searchParams.get('sslmode'))) u.searchParams.set('sslmode', 'verify-full');
  return u.toString();
}

/**
 * Pool node-postgres usado só para cargas em massa (COPY FROM STDIN), muito mais rápido
 * que INSERTs. Usa a ligação DIRETA: a Neon recomenda operações longas/em massa fora do pooler.
 */
@Injectable()
export class PgService implements OnModuleDestroy {
  readonly pool: pg.Pool;

  constructor(config: ConfigService) {
    this.pool = new pg.Pool({
      connectionString: withVerifiedSsl(config.get<string>('DIRECT_DATABASE_URL')),
      max: Number(config.get('IMPORT_CONCURRENCY')) + 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
    // Erros em ligações inativas (ex.: a base de dados reiniciou) não devem derrubar o processo.
    this.pool.on('error', () => undefined);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
