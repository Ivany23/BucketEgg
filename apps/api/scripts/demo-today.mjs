// Atualiza a demonstração para o dia de HOJE (Maputo): rotas otimizadas para cada promotor,
// entradas, algumas visitas com encomenda e cobranças. Pode correr várias vezes no mesmo dia
// sem duplicar (salta o que já existe). Uso: node scripts/demo-today.mjs [http://localhost:3000]
// Só para a base de DEMONSTRAÇÃO (criada com scripts/seed-demo.mjs).
const BASE = process.argv[2] ?? 'http://localhost:3000';
const PASSWORD = 'Demo2026Forte';
const WAREHOUSE = { lat: -25.9692, lng: 32.5732 };
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s] ${m}`);

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
const login = async (email) => (await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } })).access_token;

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo' }).format(new Date());
const owner = await login('dono@bucketegg.demo');
const project = (await api('/projects', { token: owner })).find((p) => p.name === 'Distribuição Maputo');
if (!project) throw new Error('Projeto "Distribuição Maputo" não encontrado: corra primeiro scripts/seed-demo.mjs.');

// 1) Uma rota de hoje por promotor com beat (a partir das lojas do beat), se ainda não tiver.
const existing = await api(`/projects/${project.id}/routes?date=${today}`, { token: owner });
const withRoute = new Set(existing.map((r) => r.assigneeId));
const beats = await api(`/projects/${project.id}/beats`, { token: owner });
let planned = 0;
for (const b of beats) {
  if (!b.assigneeId || withRoute.has(b.assigneeId)) continue;
  const detail = await api(`/beats/${b.id}`, { token: owner });
  const outletIds = detail.outlets.filter((o) => o.outlet.status === 'ACTIVE').map((o) => o.outletId);
  if (!outletIds.length) continue;
  await api('/routes/plan', {
    token: owner,
    method: 'POST',
    body: {
      projectId: project.id,
      assigneeId: b.assigneeId,
      beatId: b.id,
      name: `${b.name} - ${today}`,
      date: `${today}T08:00:00+02:00`,
      outletIds,
      startLocation: WAREHOUSE,
    },
  });
  withRoute.add(b.assigneeId);
  planned++;
}
log(`Rotas de hoje: ${planned} novas (${existing.length} já existiam)`);

// 2) Entradas e algumas visitas (só paragens ainda por visitar).
const reps = ['joao.mabunda', 'maria.sitoe', 'pedro.nhantumbo', 'rita.chissano', 'tomas.muianga'];
const products = (await api('/products?limit=50', { token: owner })).data;
let visits = 0;
let orders = 0;
for (const [r, handle] of reps.entries()) {
  const token = await login(`${handle}@bucketegg.demo`);
  try {
    await api('/attendance/clock-in', { token, method: 'POST', body: { projectId: project.id, lat: WAREHOUSE.lat, lng: WAREHOUSE.lng } });
  } catch (e) {
    if (e.status !== 409) throw e;
  }
  const active = await api('/visits/active', { token });
  if (active) continue; // não mexer numa visita em curso
  const day = await api(`/routes/my-day?date=${today}`, { token });
  // O 1.º promotor fica com o dia por fazer (para demonstrar o check-in na aplicação).
  const todo = r === 0 ? [] : day.tasks.filter((t) => t.status === 'PENDING' && t.outlet.latitude != null).slice(0, 2 + (r % 2));
  for (const [s, task] of todo.entries()) {
    const v = await api('/visits/check-in', {
      token,
      method: 'POST',
      body: { outletId: task.outletId, taskId: task.id, lat: task.outlet.latitude + 0.0003, lng: task.outlet.longitude },
    });
    visits++;
    let ordered = false;
    if ((s + r) % 3 !== 2) {
      const items = [products[(s + r) % products.length], products[(s + r + 5) % products.length]].map((p, k) => ({
        productId: p.id,
        quantity: 1 + ((s + k + r) % 3),
      }));
      try {
        await api('/orders', { token, method: 'POST', body: { outletId: task.outletId, visitId: v.id, items } });
        orders++;
        ordered = true;
      } catch (e) {
        if (!String(e.message).includes('crédito')) throw e;
      }
    }
    await api(`/visits/${v.id}/check-out`, {
      token,
      method: 'POST',
      body: ordered ? { notes: 'Visita concluída' } : { noOrderReason: 'Stock suficiente', notes: 'Sem encomenda hoje' },
    });
  }
}
log(`Terreno: ${visits} visitas, ${orders} encomendas (João tem o dia todo por fazer)`);
console.log(`Demonstração atualizada para ${today}.`);
