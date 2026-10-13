import { Logger } from '@nestjs/common';

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me';

const positiveInt = (env: Record<string, string | undefined>, key: string, fallback: number, errors: string[]) => {
  const raw = env[key];
  if (raw === undefined || raw === '') {
    env[key] = String(fallback);
    return;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) errors.push(`${key} deve ser um inteiro positivo.`);
};

/**
 * Valida as variáveis de ambiente no arranque. Falha cedo em produção se faltar
 * algo crítico, em vez de arrancar com uma chave JWT conhecida publicamente.
 */
export function validateEnv(config: Record<string, unknown>) {
  const env = { ...config } as Record<string, string | undefined>;
  const isProd = env.NODE_ENV === 'production';
  const errors: string[] = [];

  if (!env.DATABASE_URL) errors.push('DATABASE_URL é obrigatório.');
  // Ligação direta (sem pooler) para importações em massa com COPY. Sem ela usa a mesma da API.
  env.DIRECT_DATABASE_URL ||= env.DATABASE_URL;

  if (!env.JWT_SECRET) {
    if (isProd) errors.push('JWT_SECRET é obrigatório em produção.');
    else {
      new Logger('Config').warn('JWT_SECRET não definido: a usar chave de desenvolvimento insegura.');
      env.JWT_SECRET = DEV_JWT_SECRET;
    }
  } else if (isProd && env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET deve ter pelo menos 32 caracteres em produção.');
  }

  env.JWT_EXPIRES_IN ??= '1d';
  env.PORT ??= '3000';
  env.CORS_ORIGINS ??= 'http://localhost:3001';
  // Atrás de um balanceador/proxy (Railway, Render, Cloud Run...) o IP real vem em X-Forwarded-For.
  env.TRUST_PROXY ??= isProd ? '1' : 'false';

  // Armazenamento dos ficheiros importados: disco local (dev / 1 instância) ou S3/R2 (produção).
  env.STORAGE_DRIVER ??= 'local';
  if (!['local', 's3'].includes(env.STORAGE_DRIVER)) errors.push('STORAGE_DRIVER deve ser "local" ou "s3".');
  env.STORAGE_LOCAL_DIR ??= './storage';
  if (env.STORAGE_DRIVER === 's3') {
    for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      if (!env[key]) errors.push(`${key} é obrigatório com STORAGE_DRIVER=s3.`);
    }
    env.S3_REGION ||= 'auto';
  }

  positiveInt(env, 'UPLOAD_MAX_MB', 500, errors);
  positiveInt(env, 'IMPORT_MAX_ROWS', 5_000_000, errors);
  positiveInt(env, 'IMPORT_CONCURRENCY', 2, errors);
  positiveInt(env, 'AUTH_CACHE_TTL_MS', 10_000, errors);
  positiveInt(env, 'THROTTLE_PER_MINUTE', 600, errors);
  // Ligações à base de dados POR PROCESSO. Total = processos x (DB_POOL_SIZE + IMPORT_CONCURRENCY + 1).
  positiveInt(env, 'DB_POOL_SIZE', 10, errors);
  positiveInt(env, 'DB_POOL_TIMEOUT', 10, errors);
  // Transações interativas do Prisma: espera por ligação e duração máxima (ms).
  positiveInt(env, 'DB_TX_MAX_WAIT_MS', 10_000, errors);
  positiveInt(env, 'DB_TX_TIMEOUT_MS', 15_000, errors);
  env.IMPORT_WORKER_ENABLED ??= 'true';

  if (errors.length) throw new Error(`Configuração inválida:\n - ${errors.join('\n - ')}`);
  return env;
}
