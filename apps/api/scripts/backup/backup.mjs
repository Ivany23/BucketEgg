// pnpm db:backup — backup incremental da base de dados para BACKUP_DATABASE_URL (ver lib.mjs).
// Origem: BACKUP_SOURCE_URL, ou a ligação direta da API (DIRECT_DATABASE_URL / DATABASE_URL).
import { describeDb, loadEnv, runBackup } from './lib.mjs';

const env = loadEnv();
const sourceUrl = env.BACKUP_SOURCE_URL || env.DIRECT_DATABASE_URL || env.DATABASE_URL;
const backupUrl = env.BACKUP_DATABASE_URL;
const stamp = () => new Date().toLocaleString('pt-PT', { timeZoneName: 'short' });

if (!sourceUrl || !backupUrl) {
  console.error('Defina DIRECT_DATABASE_URL (origem) e BACKUP_DATABASE_URL (destino) no .env.');
  process.exit(1);
}

console.log(`[${stamp()}] Backup incremental ${describeDb(sourceUrl)} -> ${describeDb(backupUrl)}`);
const started = Date.now();
try {
  const { runId, stats } = await runBackup({ sourceUrl, backupUrl, log: console.log });
  const sum = (k) => Object.values(stats).reduce((a, s) => a + s[k], 0);
  console.log(
    `[${stamp()}] OK (execução #${runId}, ${((Date.now() - started) / 1000).toFixed(1)} s): ` +
      `${sum('novas')} novas, ${sum('alteradas')} alteradas, ${sum('apagadas')} apagadas na origem, ` +
      `${sum('transferidas')} linhas transferidas de ${sum('total')}.`,
  );
} catch (e) {
  console.error(`[${stamp()}] FALHOU: ${e?.message ?? e}`);
  process.exit(1);
}
