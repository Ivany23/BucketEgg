// Backup incremental da base de dados (PostgreSQL / Neon) para outra base PostgreSQL.
//
// Destino (BACKUP_DATABASE_URL):
//   mirror.<tabela>  cópia de cada tabela de "public", com a mesma chave primária (estado do último backup)
//   bk.runs          uma linha por execução (estado, contagens por tabela, erro)
//   bk.history       versões antigas: linhas ALTERADAS (op=UPDATE) ou APAGADAS na origem (op=DELETE)
//
// Cada execução só acrescenta: linhas novas entram no mirror, linhas alteradas guardam a versão
// anterior em bk.history antes de serem atualizadas, e linhas apagadas na origem passam para
// bk.history. Nada é perdido e a chave primária impede duplicados (correr 2x seguidas não muda nada).
import { existsSync, readFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';
import copyStreams from 'pg-copy-streams';

const MIRROR = 'mirror';
const META = 'bk';
/** Coluna do espelho com o md5 da linha na origem (deteta alterações sem transferir a linha). */
const HASH = '_bk_hash';
/** Chave do pg_advisory_lock no destino: impede dois backups em simultâneo. */
const LOCK_KEY = 72_700_101;

const q = (id) => `"${String(id).replace(/"/g, '""')}"`;

/** Variáveis do .env (as do processo têm prioridade), como o ConfigModule da API. */
export function loadEnv(file = '.env') {
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  return { ...fromFile, ...process.env };
}

/**
 * O driver pg avisa que "sslmode=require" passará a ter a semântica do libpq (sem verificar o
 * certificado). Hoje já verifica; tornamos isso explícito com verify-full (a Neon usa certificados públicos).
 */
export function pgUrl(url) {
  const u = new URL(url);
  if (['require', 'prefer', 'verify-ca'].includes(u.searchParams.get('sslmode'))) u.searchParams.set('sslmode', 'verify-full');
  return u.toString();
}

/** "host/base" — identifica a base sem expor a senha. */
export function describeDb(url) {
  const u = new URL(url);
  return `${u.hostname}/${u.pathname.slice(1)}`;
}

function client(url, name) {
  const c = new pg.Client({ connectionString: pgUrl(url), application_name: name, connectionTimeoutMillis: 20_000 });
  c.on('error', () => undefined);
  return c;
}

/** Tabelas de "public" com colunas (enums guardados como texto) e chave primária. */
async function sourceTables(src) {
  const { rows } = await src.query(`
    SELECT c.relname AS "table",
      json_agg(json_build_object('name', a.attname, 'type',
        CASE WHEN t.typtype = 'e' THEN 'text'
             WHEN et.typtype = 'e' THEN 'text[]'
             ELSE format_type(a.atttypid, a.atttypmod) END) ORDER BY a.attnum) AS columns,
      (SELECT json_agg(pa.attname ORDER BY k.ord)
         FROM pg_index i
         CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
         JOIN pg_attribute pa ON pa.attrelid = i.indrelid AND pa.attnum = k.attnum
        WHERE i.indrelid = c.oid AND i.indisprimary) AS pk
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    JOIN pg_type t ON t.oid = a.atttypid
    LEFT JOIN pg_type et ON et.oid = t.typelem AND t.typcategory = 'A'
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'
    GROUP BY c.oid, c.relname
    ORDER BY c.relname`);
  for (const t of rows) {
    if (!t.pk) throw new Error(`A tabela ${t.table} não tem chave primária: não é possível evitar duplicados.`);
  }
  return rows;
}

async function ensureMeta(dst) {
  await dst.query(`
    CREATE SCHEMA IF NOT EXISTS ${MIRROR};
    CREATE SCHEMA IF NOT EXISTS ${META};
    CREATE TABLE IF NOT EXISTS ${META}.runs (
      id          bigserial PRIMARY KEY,
      source      text NOT NULL,
      status      text NOT NULL DEFAULT 'RUNNING',
      started_at  timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz,
      stats       jsonb,
      error       text
    );
    CREATE TABLE IF NOT EXISTS ${META}.history (
      id          bigserial PRIMARY KEY,
      run_id      bigint NOT NULL REFERENCES ${META}.runs(id),
      table_name  text NOT NULL,
      op          text NOT NULL CHECK (op IN ('UPDATE', 'DELETE')),
      pk          jsonb NOT NULL,
      row_data    jsonb NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS history_table_pk_idx ON ${META}.history (table_name, pk);`);
}

/** Cria a tabela espelho; colunas novas na origem são acrescentadas (as removidas ficam, a NULL). */
async function ensureMirror(dst, t) {
  const table = `${MIRROR}.${q(t.table)}`;
  const cols = t.columns.map((c) => `${q(c.name)} ${c.type}`).join(', ');
  const [, { rows }] = await dst.query(
    `CREATE TABLE IF NOT EXISTS ${table} (${cols}, ${q(HASH)} text, PRIMARY KEY (${t.pk.map(q).join(', ')}));
     SELECT column_name FROM information_schema.columns
     WHERE table_schema = '${MIRROR}' AND table_name = '${t.table.replace(/'/g, "''")}'`,
  );
  const have = new Set(rows.map((r) => r.column_name));
  for (const c of [...t.columns, { name: HASH, type: 'text' }]) {
    if (!have.has(c.name)) await dst.query(`ALTER TABLE ${table} ADD COLUMN ${q(c.name)} ${c.type}`);
  }
}

/**
 * Sincroniza uma tabela transferindo só o que mudou:
 *   1. a origem envia (chave, md5 da linha) de todas as linhas — ~70 bytes por linha;
 *   2. o destino compara com o md5 guardado no espelho e devolve as chaves novas/alteradas;
 *   3. só essas linhas viajam completas.
 */
async function syncTable(src, dst, t, runId) {
  await ensureMirror(dst, t);
  const table = `${MIRROR}.${q(t.table)}`;
  const srcTable = `public.${q(t.table)}`;
  const hashes = q(`bkh_${t.table}`);
  const want = q(`bkw_${t.table}`);
  const stg = q(`stg_${t.table}`);
  const colList = t.columns.map((c) => q(c.name)).join(', ');
  const pkList = t.pk.map(q).join(', ');
  const pkDefs = t.pk.map((k) => `${q(k)} ${t.columns.find((c) => c.name === k).type}`).join(', ');
  const pkSet = new Set(t.pk);
  const data = t.columns.map((c) => c.name).filter((n) => !pkSet.has(n));
  const on = (a, b) => t.pk.map((k) => `${a}.${q(k)} = ${b}.${q(k)}`).join(' AND ');
  const pkJson = (a) => `jsonb_build_object(${t.pk.map((k) => `'${k.replace(/'/g, "''")}', ${a}.${q(k)}`).join(', ')})`;
  const tuple = (a) => `ROW(${data.map((n) => `${a}.${q(n)}`).join(', ')})`;
  // Valores em literal porque o protocolo simples (multi-instrução) não aceita parâmetros.
  const lit = `${Number(runId)}, '${t.table.replace(/'/g, "''")}'`;
  const R = '_bk_row'; // alias da linha inteira (md5 do seu texto = impressão digital)

  // 1) Impressões digitais de todas as linhas da origem (fotografia consistente).
  await dst.query(`CREATE TEMP TABLE ${hashes} (${pkDefs}, h text) ON COMMIT DROP`);
  await pipeline(
    src.query(copyStreams.to(`COPY (SELECT ${t.pk.map((k) => `${R}.${q(k)}`).join(', ')}, md5(${R}::text) FROM ${srcTable} ${R}) TO STDOUT`)),
    dst.query(copyStreams.from(`COPY ${hashes} (${pkList}, h) FROM STDIN`)),
  );

  // 2) Apagadas na origem (saem do espelho mas ficam no histórico) e lista das linhas a pedir.
  const r2 = await dst.query(
    [
      `CREATE UNIQUE INDEX ON ${hashes} (${pkList})`,
      `ANALYZE ${hashes}`,
      `SELECT count(*)::int AS n FROM ${hashes}`,
      `WITH gone AS (
         DELETE FROM ${table} m WHERE NOT EXISTS (SELECT 1 FROM ${hashes} h WHERE ${on('m', 'h')}) RETURNING m.*
       )
       INSERT INTO ${META}.history (run_id, table_name, op, pk, row_data)
       SELECT ${lit}, 'DELETE', ${pkJson('gone')}, to_jsonb(gone) - '${HASH}' FROM gone`,
      `CREATE TEMP TABLE ${want} ON COMMIT DROP AS
       SELECT ${t.pk.map((k) => `h.${q(k)}`).join(', ')} FROM ${hashes} h
       LEFT JOIN ${table} m ON ${on('m', 'h')} WHERE m.${q(HASH)} IS DISTINCT FROM h.h`,
      `DROP TABLE ${hashes}`,
    ].join(';\n'),
  );
  const total = r2[2].rows[0].n;
  const apagadas = r2[3].rowCount;
  const transferidas = r2[4].rowCount;
  let novas = 0;
  let alteradas = 0;

  if (transferidas > 0) {
    // 3) Envia as chaves pedidas à origem e recebe só essas linhas, completas.
    await src.query(`CREATE TEMP TABLE ${want} (${pkDefs}) ON COMMIT DROP`);
    await pipeline(
      dst.query(copyStreams.to(`COPY ${want} TO STDOUT`)),
      src.query(copyStreams.from(`COPY ${want} (${pkList}) FROM STDIN`)),
    );
    await src.query(`ANALYZE ${want}`);
    await dst.query(`CREATE TEMP TABLE ${stg} (LIKE ${table}) ON COMMIT DROP`);
    await pipeline(
      src.query(
        copyStreams.to(
          `COPY (SELECT ${t.columns.map((c) => `${R}.${q(c.name)}`).join(', ')}, md5(${R}::text)
                 FROM ${srcTable} ${R} JOIN ${want} w ON ${on(R, 'w')}) TO STDOUT`,
        ),
      ),
      dst.query(copyStreams.from(`COPY ${stg} (${colList}, ${q(HASH)}) FROM STDIN`)),
    );
    await src.query(`DROP TABLE ${want}`);

    // 4) Aplica numa só ida e volta (a base pode estar longe).
    const changed = `${tuple('m')} IS DISTINCT FROM ${tuple('s')}`;
    const setCols = [...data, HASH];
    const r4 = await dst.query(
      [
        `CREATE UNIQUE INDEX ON ${stg} (${pkList})`,
        `ANALYZE ${stg}`,
        // Alteradas de facto: a versão anterior vai para o histórico antes de o espelho ser atualizado.
        data.length
          ? `INSERT INTO ${META}.history (run_id, table_name, op, pk, row_data)
             SELECT ${lit}, 'UPDATE', ${pkJson('m')}, to_jsonb(m) - '${HASH}'
             FROM ${table} m JOIN ${stg} s ON ${on('m', 's')} WHERE ${changed}`
          : 'SELECT 1 WHERE false',
        `UPDATE ${table} m SET (${setCols.map(q).join(', ')}) = ROW(${setCols.map((n) => `s.${q(n)}`).join(', ')})
         FROM ${stg} s WHERE ${on('m', 's')}`,
        // Novas: acrescentadas (a chave primária garante que nunca há duplicados).
        `INSERT INTO ${table} (${colList}, ${q(HASH)})
         SELECT ${[...t.columns.map((c) => c.name), HASH].map((n) => `s.${q(n)}`).join(', ')} FROM ${stg} s
         WHERE NOT EXISTS (SELECT 1 FROM ${table} m WHERE ${on('m', 's')})`,
        `DROP TABLE ${stg}`,
        `DROP TABLE ${want}`,
      ].join(';\n'),
    );
    alteradas = r4[2].rowCount ?? 0;
    novas = r4[4].rowCount;
  } else {
    await dst.query(`DROP TABLE ${want}`);
  }
  return { total, novas, alteradas, apagadas, transferidas };
}

/** Executa um backup incremental. Devolve o id da execução e as contagens por tabela. */
export async function runBackup({ sourceUrl, backupUrl, log = () => undefined }) {
  if (describeDb(sourceUrl).replace('-pooler.', '.') === describeDb(backupUrl).replace('-pooler.', '.')) {
    throw new Error('A origem e o destino do backup são a mesma base de dados.');
  }
  const src = client(sourceUrl, 'bucketegg-backup-source');
  const dst = client(backupUrl, 'bucketegg-backup');
  await src.connect();
  await dst.connect();
  try {
    // A Neon corta sessões "idle in transaction" ao fim de 5 min. Com tabelas grandes, a origem fica
    // parada na sua transação enquanto o destino processa (e vice-versa): limite alargado só nestas sessões.
    await src.query(`SET idle_in_transaction_session_timeout = '2h'`);
    await dst.query(`SET idle_in_transaction_session_timeout = '2h'`);
    const {
      rows: [{ locked }],
    } = await dst.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY]);
    if (!locked) throw new Error('Já está a decorrer outro backup para este destino.');

    await ensureMeta(dst);
    const {
      rows: [{ id: runId }],
    } = await dst.query(`INSERT INTO ${META}.runs (source) VALUES ($1) RETURNING id`, [describeDb(sourceUrl)]);
    try {
      // Fotografia consistente de todas as tabelas no mesmo instante.
      // (Não READ ONLY: são criadas tabelas TEMPORÁRIAS com as chaves pedidas; as tabelas reais só são lidas.)
      await src.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      const tables = await sourceTables(src);
      // Tudo ou nada no destino: um backup interrompido não deixa o espelho a meio.
      await dst.query('BEGIN');
      const stats = {};
      for (const t of tables) {
        stats[t.table] = await syncTable(src, dst, t, runId);
        log(`  ${t.table.padEnd(24)} ${JSON.stringify(stats[t.table])}`);
      }
      await dst.query(`UPDATE ${META}.runs SET status = 'OK', finished_at = now(), stats = $2 WHERE id = $1`, [
        runId,
        stats,
      ]);
      await dst.query('COMMIT');
      await src.query('COMMIT');
      return { runId: Number(runId), stats };
    } catch (e) {
      await dst.query('ROLLBACK').catch(() => undefined);
      await dst
        .query(`UPDATE ${META}.runs SET status = 'FAILED', finished_at = now(), error = $2 WHERE id = $1`, [
          runId,
          String(e?.message ?? e),
        ])
        .catch(() => undefined);
      throw e;
    }
  } finally {
    await src.end().catch(() => undefined);
    await dst.end().catch(() => undefined);
  }
}

/** Ordena as tabelas para que as referenciadas (chaves estrangeiras) venham primeiro. */
function fkOrder(tables, edges) {
  const deps = new Map(tables.map((t) => [t, new Set()]));
  for (const { child, parent } of edges) if (child !== parent && deps.has(child) && deps.has(parent)) deps.get(child).add(parent);
  const order = [];
  const done = new Set();
  while (order.length < tables.length) {
    const ready = tables.filter((t) => !done.has(t) && [...deps.get(t)].every((d) => done.has(d)));
    if (!ready.length) throw new Error('Dependências circulares entre tabelas: restauro automático impossível.');
    for (const t of ready) {
      done.add(t);
      order.push(t);
    }
  }
  return order;
}

/**
 * Restaura o espelho do backup numa base VAZIA já migrada (pnpm db:deploy).
 * Recusa escrever numa base que já tenha dados.
 */
export async function restoreBackup({ backupUrl, targetUrl, log = () => undefined }) {
  const bk = client(backupUrl, 'bucketegg-restore-source');
  const dst = client(targetUrl, 'bucketegg-restore');
  await bk.connect();
  await dst.connect();
  try {
    await bk.query(`SET idle_in_transaction_session_timeout = '2h'`);
    await dst.query(`SET idle_in_transaction_session_timeout = '2h'`);
    const { rows: mirrorTables } = await bk.query(
      `SELECT table_name AS t, json_agg(column_name::text) AS cols FROM information_schema.columns
       WHERE table_schema = $1 GROUP BY table_name`,
      [MIRROR],
    );
    if (!mirrorTables.length) throw new Error('O backup está vazio (ainda não correu nenhum backup).');
    const { rows: targetCols } = await dst.query(
      `SELECT table_name AS t, json_agg(column_name::text) AS cols FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' GROUP BY table_name`,
    );
    if (!targetCols.length) throw new Error('A base de destino não tem tabelas: corra primeiro "pnpm db:deploy".');
    const target = new Map(targetCols.map((r) => [r.t, new Set(r.cols)]));
    const tables = mirrorTables.map((r) => r.t).filter((t) => target.has(t));
    for (const t of mirrorTables.map((r) => r.t).filter((t) => !target.has(t))) log(`  (ignorada, não existe no destino) ${t}`);

    for (const t of tables) {
      const { rows } = await dst.query(`SELECT EXISTS (SELECT 1 FROM public.${q(t)}) AS has`);
      if (rows[0].has) throw new Error(`A tabela ${t} do destino já tem dados: o restauro só escreve numa base vazia.`);
    }

    const { rows: edges } = await dst.query(`
      SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.contype = 'f' AND n.nspname = 'public'`);
    const unq = (s) => s.replace(/^public\./, '').replace(/^"|"$/g, '');
    const order = fkOrder(tables, edges.map((e) => ({ child: unq(e.child), parent: unq(e.parent) })));

    await bk.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await dst.query('BEGIN');
    const stats = {};
    for (const t of order) {
      const mirrorCols = mirrorTables.find((r) => r.t === t).cols;
      const cols = mirrorCols.filter((c) => target.get(t).has(c)).map(q).join(', ');
      await pipeline(
        bk.query(copyStreams.to(`COPY (SELECT ${cols} FROM ${MIRROR}.${q(t)}) TO STDOUT`)),
        dst.query(copyStreams.from(`COPY public.${q(t)} (${cols}) FROM STDIN`)),
      );
      const { rows } = await dst.query(`SELECT count(*)::int AS n FROM public.${q(t)}`);
      stats[t] = rows[0].n;
      log(`  ${t.padEnd(24)} ${rows[0].n} linhas`);
    }
    // Sequências (ex.: records.seq) continuam a partir do maior valor restaurado.
    const { rows: seqs } = await dst.query(`
      SELECT table_name AS t, column_name AS c, pg_get_serial_sequence(format('public.%I', table_name), column_name) AS s
      FROM information_schema.columns WHERE table_schema = 'public'`);
    for (const { t, c, s } of seqs.filter((r) => r.s && tables.includes(r.t))) {
      await dst.query(`SELECT setval($1, COALESCE((SELECT max(${q(c)}) FROM public.${q(t)}), 1), (SELECT count(*) > 0 FROM public.${q(t)}))`, [s]);
    }
    await dst.query('COMMIT');
    await bk.query('COMMIT');
    return stats;
  } catch (e) {
    await dst.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await bk.end().catch(() => undefined);
    await dst.end().catch(() => undefined);
  }
}
