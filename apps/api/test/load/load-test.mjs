// Teste de carga: N auditores (contas diferentes) a usar a API ao mesmo tempo.
// Uso: node test/load/load-test.mjs [http://localhost:3000] [utilizadores=500] [segundos=20] [pedidos/s]
// Sem pedidos/s: cada utilizador dispara sem pausa (mede a capacidade máxima; a latência é sobretudo fila).
// Com pedidos/s: taxa fixa total (mede o tempo de resposta realista, como recomenda o autocannon).
// Cria uma organização, utilizadores e dados novos: use uma base de dados de TESTE.
import autocannon from 'autocannon';

const [base = 'http://localhost:3000', usersArg = '500', secondsArg = '20', rateArg] = process.argv.slice(2);
const RATE = rateArg ? Number(rateArg) : undefined;
const USERS = Number(usersArg);
const SECONDS = Number(secondsArg);

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

/** Executa tarefas com concorrência limitada. */
async function pool(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

console.log(`Preparação: organização, 300 lojas, formulário e ${USERS} auditores...`);
const stamp = Date.now();
const owner = await api('/auth/register', {
  method: 'POST',
  body: { email: `owner-${stamp}@load.local`, password: 'SenhaForte123', organizationName: 'Carga' },
});
const ownerToken = owner.access_token;
const project = await api('/projects', { method: 'POST', token: ownerToken, body: { name: 'Carga' } });
const outlets = await pool(Array.from({ length: 300 }), 20, (_, i) =>
  api(`/projects/${project.id}/outlets`, {
    method: 'POST',
    token: ownerToken,
    body: { name: `Loja carga ${i}`, code: `LC-${i}`, latitude: -25.9 - i * 0.001, longitude: 32.5 + i * 0.001, force: true },
  }),
);
const form = await api(`/projects/${project.id}/forms`, {
  method: 'POST',
  token: ownerToken,
  body: { name: 'Auditoria', fields: [{ label: 'Presente', type: 'boolean' }, { label: 'Preço', type: 'number' }, { label: 'Obs' }] },
});

let t = Date.now();
const tokens = await pool(Array.from({ length: USERS }), 25, async (_, i) => {
  const email = `auditor-${stamp}-${i}@load.local`;
  await api('/team', { method: 'POST', token: ownerToken, body: { email, password: 'SenhaForte123', role: 'FIELD_REP' } });
  return (await api('/auth/login', { method: 'POST', body: { email, password: 'SenhaForte123' } })).access_token;
});
console.log(`${USERS} auditores criados e autenticados em ${((Date.now() - t) / 1000).toFixed(1)}s\n`);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const auth = () => ({ authorization: `Bearer ${pick(tokens)}`, 'content-type': 'application/json' });

const scenarios = [
  {
    title: 'Leituras (perfil, lojas, rotas do dia, formulários)',
    requests: [
      { method: 'GET', path: '/auth/me', setupRequest: (r) => ({ ...r, headers: auth() }) },
      { method: 'GET', path: `/projects/${project.id}/outlets?limit=20`, setupRequest: (r) => ({ ...r, headers: auth() }) },
      { method: 'GET', path: '/routes/my-day', setupRequest: (r) => ({ ...r, headers: auth() }) },
      { method: 'GET', path: `/datasets/project/${project.id}`, setupRequest: (r) => ({ ...r, headers: auth() }) },
    ],
  },
  {
    title: 'Recolha de dados (auditores a submeter formulários)',
    requests: [
      {
        method: 'POST',
        path: `/datasets/${form.id}/records`,
        setupRequest: (r) => ({
          ...r,
          headers: auth(),
          body: JSON.stringify({
            data: { col_0: Math.random() > 0.2, col_1: Math.round(Math.random() * 1000), col_2: 'Prateleira arrumada — ok' },
            outletId: pick(outlets).id,
            gpsLat: -25.96,
            gpsLng: 32.58,
          }),
        }),
      },
    ],
  },
];

for (const s of scenarios) {
  const result = await autocannon({ url: base, connections: USERS, duration: SECONDS, requests: s.requests, overallRate: RATE });
  const l = result.latency;
  console.log(`== ${s.title}`);
  console.log(`   ${USERS} ligações simultâneas durante ${SECONDS}s${RATE ? ` (taxa fixa: ${RATE} pedidos/s)` : " (sem pausa: capacidade máxima)"}`);
  console.log(`   Pedidos: ${result.requests.total.toLocaleString('pt-PT')} (${Math.round(result.requests.average)} /s)`);
  console.log(`   Latência: mediana ${l.p50} ms | p90 ${l.p90} ms | p99 ${l.p99} ms | máx ${l.max} ms`);
  console.log(`   Respostas 2xx: ${result['2xx']} | não-2xx: ${result.non2xx} | erros de ligação: ${result.errors} | timeouts: ${result.timeouts}\n`);
}

const recs = await api(`/datasets/${form.id}/records?limit=1`, { token: ownerToken });
console.log(`Registos gravados pela recolha: ${recs.meta.total.toLocaleString('pt-PT')}`);
