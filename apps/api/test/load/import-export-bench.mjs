// Mede uma importação e a exportação de um ficheiro grande contra uma API a correr.
// Uso: node test/load/import-export-bench.mjs <ficheiro> [http://localhost:3000]
// Cria uma conta e um projeto novos (use uma base de dados de TESTE).
import { openAsBlob } from 'node:fs';
import { basename } from 'node:path';

const [file, base = 'http://localhost:3000'] = process.argv.slice(2);
if (!file) {
  console.error('Uso: node test/load/import-export-bench.mjs <ficheiro> [url-da-api]');
  process.exit(1);
}

async function api(path, { token, ...init } = {}) {
  const res = await fetch(base + path, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  return res;
}
const json = async (path, init) => (await api(path, init)).json();
const secs = (t) => ((Date.now() - t) / 1000).toFixed(1);

const email = `bench-${Date.now()}@test.local`;
const { access_token: token } = await json('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, password: 'SenhaForte123', organizationName: 'Benchmark' }),
});
const project = await json('/projects', { method: 'POST', token, body: JSON.stringify({ name: 'Benchmark' }) });

const blob = await openAsBlob(file); // lido do disco em streaming pelo fetch
console.log(`Ficheiro: ${basename(file)} (${(blob.size / 1048576).toFixed(1)} MB)`);
const form = new FormData();
form.append('projectId', project.id);
form.append('file', blob, basename(file));

let t = Date.now();
const job = await json('/imports/upload', { method: 'POST', token, body: form });
console.log(`Upload concluído em ${secs(t)}s (resposta imediata: job ${job.status})`);

t = Date.now();
let current = job;
let lastLog = 0;
while (['QUEUED', 'PROCESSING'].includes(current.status)) {
  await new Promise((r) => setTimeout(r, 1000));
  current = await json(`/imports/${job.id}`, { token });
  if (Date.now() - lastLog > 10_000) {
    console.log(`  ... ${current.status} ${current.rowsProcessed.toLocaleString('pt-PT')} linhas (${secs(t)}s)`);
    lastLog = Date.now();
  }
}
const importSecs = (Date.now() - t) / 1000;
console.log(
  `Importação ${current.status}: ${current.rowsProcessed.toLocaleString('pt-PT')} linhas em ${importSecs.toFixed(1)}s ` +
    `(${Math.round(current.rowsProcessed / importSecs).toLocaleString('pt-PT')} linhas/s)${current.error ? ` erro: ${current.error}` : ''}`,
);
if (current.status !== 'COMPLETED') process.exit(1);

t = Date.now();
const page = await json(`/datasets/${current.datasetId}/records?limit=100`, { token });
const cursorPage = await json(`/datasets/${current.datasetId}/records?limit=100&cursor=${page.meta.nextCursor}`, { token });
console.log(`Leitura de 2 páginas de 100 registos (total ${page.meta.total.toLocaleString('pt-PT')}): ${Date.now() - t} ms`);
if (cursorPage.data.length !== 100) throw new Error('paginação por cursor falhou');

for (const format of ['csv', 'xlsx']) {
  t = Date.now();
  const res = await api(`/datasets/${current.datasetId}/download?format=${format}`, { token });
  let bytes = 0;
  let lines = 0;
  let corrupted = 0;
  let tail = Buffer.alloc(0);
  for await (const chunk of res.body) {
    bytes += chunk.length;
    if (format !== 'csv') continue;
    // Integridade: conta linhas e caracteres corrompidos (U+FFFD = EF BF BD em UTF-8).
    const buf = Buffer.concat([tail, chunk]);
    for (let i = 0; i < buf.length - 2; i++) {
      if (buf[i] === 0xef && buf[i + 1] === 0xbf && buf[i + 2] === 0xbd) corrupted++;
    }
    for (const b of chunk) if (b === 0x0a) lines++;
    tail = buf.subarray(Math.max(buf.length - 2, 0));
  }
  console.log(`Exportação ${format.toUpperCase()}: ${(bytes / 1048576).toFixed(1)} MB em ${secs(t)}s`);
  if (format === 'csv') {
    const ok = lines === current.rowsProcessed + 1 && corrupted === 0;
    console.log(`  Integridade: ${lines - 1} linhas de dados, ${corrupted} caracteres corrompidos -> ${ok ? 'OK' : 'FALHOU'}`);
    if (!ok) process.exitCode = 1;
  }
}
