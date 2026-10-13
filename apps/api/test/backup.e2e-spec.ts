import { execSync } from 'node:child_process';
import pg from 'pg';
import { type BackupStats, pgUrl, restoreBackup, runBackup } from '../scripts/backup/lib.mjs';

/**
 * Backup incremental contra PostgreSQL real (Neon): cria 3 bases de teste próprias
 * (origem, destino do backup e destino do restauro), todas com nome terminado em "_test".
 */
// Daqui até à base os pedidos podem demorar ~250 ms: limites de tempo generosos.
describe('Backup incremental (e2e)', { timeout: 120_000 }, () => {
  // Base de testes já validada no vitest.config.e2e.ts (nome terminado em "_test").
  const base = process.env.DIRECT_DATABASE_URL;
  const urlFor = (db: string) => {
    const u = new URL(base);
    u.pathname = `/${db}`;
    return u.toString();
  };
  const SRC = urlFor('bk_src_test');
  const DST = urlFor('bk_dst_test');
  const RESTORE = urlFor('bk_restore_test');
  let src: pg.Client;

  const sum = (stats: BackupStats, k: keyof BackupStats[string]) =>
    Object.values(stats).reduce((a, s) => a + s[k], 0);

  const withClient = async <T>(url: string, fn: (c: pg.Client) => Promise<T>) => {
    const c = new pg.Client({ connectionString: pgUrl(url) });
    await c.connect();
    try {
      return await fn(c);
    } finally {
      await c.end();
    }
  };
  const migrate = (url: string) =>
    execSync('pnpm exec prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
      stdio: 'pipe',
    });
  /** Impressão digital de cada tabela (todas as colunas de todas as linhas). */
  const fingerprint = (url: string) =>
    withClient(url, async (c) => {
      const { rows } = await c.query(
        `SELECT table_name AS t FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' ORDER BY 1`,
      );
      const out: Record<string, string> = {};
      for (const { t } of rows) {
        const r = await c.query(
          `SELECT count(*)::int || ':' || md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS f FROM public."${t}" x`,
        );
        out[t] = r.rows[0].f;
      }
      return out;
    });

  beforeAll(async () => {
    await withClient(base, async (c) => {
      for (const db of ['bk_src_test', 'bk_dst_test', 'bk_restore_test']) {
        await c.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
        await c.query(`CREATE DATABASE "${db}" ENCODING 'UTF8'`);
      }
    });
    migrate(SRC);
    migrate(RESTORE);

    src = new pg.Client({ connectionString: pgUrl(SRC) });
    await src.connect();
    await src.query(`
      INSERT INTO organizations (id, name, slug, "updatedAt") VALUES ('org1', 'Distribuidora Maputo', 'dm', now());
      INSERT INTO users (id, email, password, name, "updatedAt") VALUES
        ('u1', 'dono@x.co.mz', 'hash', 'João Conceição', now()),
        ('u2', 'rep@x.co.mz', 'hash', 'Ana', now());
      INSERT INTO memberships (id, "userId", "organizationId", role) VALUES
        ('m1', 'u1', 'org1', 'OWNER'), ('m2', 'u2', 'org1', 'FIELD_REP');
      INSERT INTO membership_supervisors ("memberId", "supervisorId") VALUES ('m2', 'm1');
      INSERT INTO projects (id, name, "organizationId", "updatedAt") VALUES ('p1', 'Projeto Sul', 'org1', now());
      INSERT INTO outlets (id, name, "projectId", latitude, longitude, status, "updatedAt") VALUES
        ('o1', 'Loja Açúcar & Cª', 'p1', -25.9692, 32.5732, 'ACTIVE', now()),
        ('o2', 'Mercearia Zé', 'p1', NULL, NULL, 'PENDING_APPROVAL', now()),
        ('o3', 'Banca 3', 'p1', -25.9, 32.5, 'ACTIVE', now());
      INSERT INTO beats (id, name, weekdays, "projectId", "updatedAt") VALUES ('b1', 'Beat 1', '{1,3,5}', 'p1', now());
      INSERT INTO products (id, "organizationId", sku, name, price, "updatedAt") VALUES ('pr1', 'org1', 'CC-50', 'Coca-Cola', 50.25, now());
      INSERT INTO datasets (id, name, "projectId", schema) VALUES ('d1', 'Auditoria', 'p1', '{"fields":[{"key":"preço","type":"number"}]}');
      INSERT INTO records (id, "datasetId", "outletId", data) VALUES
        ('r1', 'd1', 'o1', '{"preço": 12.5, "nota": "linha\\ncom \\"aspas\\" e tab\\t"}'),
        ('r2', 'd1', NULL, '{"preço": null}');`);
  }, 300_000);

  afterAll(async () => {
    await src?.end();
  });

  it('1.ª execução copia todas as linhas', async () => {
    const { stats } = await runBackup({ sourceUrl: SRC, backupUrl: DST });
    expect(sum(stats, 'total')).toBe(15);
    expect(sum(stats, 'novas')).toBe(15);
    expect(sum(stats, 'alteradas')).toBe(0);
    expect(sum(stats, 'apagadas')).toBe(0);
    expect(sum(stats, 'transferidas')).toBe(15);
  });

  it('2.ª execução sem alterações não acrescenta nada (sem duplicados)', async () => {
    const { stats } = await runBackup({ sourceUrl: SRC, backupUrl: DST });
    expect([sum(stats, 'novas'), sum(stats, 'alteradas'), sum(stats, 'apagadas')]).toEqual([0, 0, 0]);
    // Incremental: sem alterações, nenhuma linha completa viaja (só as impressões digitais).
    expect(sum(stats, 'transferidas')).toBe(0);
    const n = await withClient(DST, async (c) => (await c.query('SELECT count(*)::int AS n FROM mirror.outlets')).rows[0].n);
    expect(n).toBe(3);
  });

  it('só transfere o que mudou e guarda as versões antigas e as linhas apagadas', async () => {
    await src.query(`
      UPDATE outlets SET name = 'Loja Açúcar Nova', "updatedAt" = now() WHERE id = 'o1';
      DELETE FROM outlets WHERE id = 'o3';
      INSERT INTO products (id, "organizationId", sku, name, price, "updatedAt") VALUES ('pr2', 'org1', 'FA-33', 'Fanta', 40, now());`);
    const { runId, stats } = await runBackup({ sourceUrl: SRC, backupUrl: DST });
    expect(stats.outlets).toMatchObject({ total: 2, novas: 0, alteradas: 1, apagadas: 1, transferidas: 1 });
    expect(stats.products).toMatchObject({ total: 2, novas: 1, alteradas: 0, apagadas: 0, transferidas: 1 });
    expect(sum(stats, 'transferidas')).toBe(2);
    expect([sum(stats, 'novas'), sum(stats, 'alteradas'), sum(stats, 'apagadas')]).toEqual([1, 1, 1]);

    await withClient(DST, async (c) => {
      const h = await c.query('SELECT op, pk, row_data FROM bk.history WHERE run_id = $1 ORDER BY op DESC', [runId]);
      expect(h.rows).toHaveLength(2);
      expect(h.rows[0]).toMatchObject({ op: 'UPDATE', pk: { id: 'o1' }, row_data: { name: 'Loja Açúcar & Cª' } });
      expect(h.rows[1]).toMatchObject({ op: 'DELETE', pk: { id: 'o3' }, row_data: { name: 'Banca 3' } });
      const m = await c.query(`SELECT name FROM mirror.outlets WHERE id = 'o1'`);
      expect(m.rows[0].name).toBe('Loja Açúcar Nova');
      const runs = await c.query(`SELECT count(*)::int AS n FROM bk.runs WHERE status = 'OK'`);
      expect(runs.rows[0].n).toBe(3);
      // O histórico não guarda a coluna interna do md5.
      expect(h.rows[0].row_data).not.toHaveProperty('_bk_hash');
    });
  });

  it('espelho sem impressões digitais (backup antigo): volta a transferir, mas sem falsas alterações no histórico', async () => {
    const before = await withClient(DST, async (c) => {
      await c.query('UPDATE mirror.outlets SET _bk_hash = NULL');
      return (await c.query('SELECT count(*)::int AS n FROM bk.history')).rows[0].n;
    });
    const { stats } = await runBackup({ sourceUrl: SRC, backupUrl: DST });
    expect(stats.outlets).toMatchObject({ transferidas: 2, novas: 0, alteradas: 0, apagadas: 0 });
    const after = await withClient(DST, async (c) => (await c.query('SELECT count(*)::int AS n FROM bk.history')).rows[0].n);
    expect(after).toBe(before);
    const again = await runBackup({ sourceUrl: SRC, backupUrl: DST });
    expect(sum(again.stats, 'transferidas')).toBe(0);
  });

  it('recusa dois backups em simultâneo para o mesmo destino', async () => {
    const results = await Promise.allSettled([
      runBackup({ sourceUrl: SRC, backupUrl: DST }),
      runBackup({ sourceUrl: SRC, backupUrl: DST }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(String(rejected.reason?.message)).toContain('outro backup');
  });

  it('recusa origem e destino iguais', async () => {
    await expect(runBackup({ sourceUrl: SRC, backupUrl: SRC })).rejects.toThrow('mesma base');
  });

  it('restauro reproduz a origem exatamente (todas as colunas, acentos, JSON, arrays, sequências)', async () => {
    await restoreBackup({ backupUrl: DST, targetUrl: RESTORE });
    expect(await fingerprint(RESTORE)).toEqual(await fingerprint(SRC));
    // A sequência de records.seq continua depois do maior valor restaurado.
    await withClient(RESTORE, async (c) => {
      const { rows } = await c.query(
        `INSERT INTO records (id, "datasetId", data) VALUES ('r3', 'd1', '{}') RETURNING seq,
         (SELECT max(seq) FROM records WHERE id <> 'r3') AS prev`,
      );
      expect(Number(rows[0].seq)).toBeGreaterThan(Number(rows[0].prev));
    });
  });

  it('restauro recusa uma base que já tem dados', async () => {
    await expect(restoreBackup({ backupUrl: DST, targetUrl: RESTORE })).rejects.toThrow('já tem dados');
  });
});
