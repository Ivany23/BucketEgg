import { defineConfig } from 'vitest/config';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import swc from 'unplugin-swc';

// O e2e APAGA a base de dados no início (TRUNCATE). Por isso usa SÓ a TEST_DATABASE_URL e recusa
// correr se o nome da base não terminar em "_test" — nunca toca na base de produção por engano.
const fileEnv: Record<string, string | undefined> = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
const testUrl = process.env.TEST_DATABASE_URL || fileEnv.TEST_DATABASE_URL;
const testDirectUrl = process.env.TEST_DIRECT_DATABASE_URL || fileEnv.TEST_DIRECT_DATABASE_URL || testUrl;
for (const [name, url] of [['TEST_DATABASE_URL', testUrl], ['TEST_DIRECT_DATABASE_URL', testDirectUrl]]) {
  if (!url) throw new Error(`${name} não definido (.env). O e2e precisa de uma base de dados de TESTE.`);
  const db = new URL(url).pathname.slice(1);
  if (!db.endsWith('_test')) throw new Error(`${name} aponta para "${db}": o nome da base de testes tem de terminar em "_test".`);
}

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    // Lido pelo ConfigModule no carregamento do AppModule (antes de qualquer beforeAll).
    // As variáveis do processo têm prioridade sobre o .env, por isso a API usa a base de testes.
    env: {
      DATABASE_URL: testUrl,
      DIRECT_DATABASE_URL: testDirectUrl,
      UPLOAD_MAX_MB: '5',
      IMPORT_CONCURRENCY: '2',
      STORAGE_LOCAL_DIR: join(tmpdir(), 'bucketegg-e2e-storage'),
    },
    hookTimeout: 60000,
  },
});
