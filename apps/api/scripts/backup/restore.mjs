// pnpm db:restore -- <URL da base de destino>
// Restaura o último estado do backup (BACKUP_DATABASE_URL) numa base VAZIA, já migrada com "pnpm db:deploy".
// Versões antigas e linhas apagadas continuam disponíveis em bk.history no destino do backup.
import { describeDb, loadEnv, restoreBackup } from './lib.mjs';

const env = loadEnv();
const targetUrl = process.argv.slice(2).find((a) => a.startsWith('postgres')) || env.RESTORE_TARGET_URL;
if (!env.BACKUP_DATABASE_URL || !targetUrl) {
  console.error('Uso: pnpm db:restore -- "postgresql://...base-vazia..."  (com BACKUP_DATABASE_URL no .env)');
  process.exit(1);
}

console.log(`Restauro ${describeDb(env.BACKUP_DATABASE_URL)} -> ${describeDb(targetUrl)}`);
try {
  const stats = await restoreBackup({ backupUrl: env.BACKUP_DATABASE_URL, targetUrl, log: console.log });
  console.log(`OK: ${Object.values(stats).reduce((a, n) => a + n, 0)} linhas restauradas.`);
} catch (e) {
  console.error(`FALHOU: ${e?.message ?? e}`);
  process.exit(1);
}
