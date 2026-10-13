// Tipos de lib.mjs (usados pelos testes em TypeScript).
export type BackupStats = Record<
  string,
  { total: number; novas: number; alteradas: number; apagadas: number; transferidas: number }
>;
type Log = (line: string) => void;

export function loadEnv(file?: string): Record<string, string | undefined>;
export function pgUrl(url: string): string;
export function describeDb(url: string): string;
export function runBackup(opts: {
  sourceUrl: string;
  backupUrl: string;
  log?: Log;
}): Promise<{ runId: number; stats: BackupStats }>;
export function restoreBackup(opts: { backupUrl: string; targetUrl: string; log?: Log }): Promise<Record<string, number>>;
