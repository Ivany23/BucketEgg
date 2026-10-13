// Dados de demonstração realistas (Maputo/Matola) criados ATRAVÉS DA API, como um utilizador real.
// Uso: node scripts/seed-demo.mjs [http://localhost:3000]
// NÃO usar contra a base principal: crie uma base própria (ex.: neondb_demo) e arranque a API ligada a ela.
// Contas criadas (palavra-passe de todas: Demo2026Forte):
//   dono@bucketegg.demo (OWNER) · ana.machava@ / carlos.tembe@ (MANAGER) · ines.cossa@ (ANALYST)
//   joao.mabunda@, maria.sitoe@, pedro.nhantumbo@, rita.chissano@, tomas.muianga@, luisa.bila@ (FIELD_REP)
import ExcelJS from 'exceljs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const PASSWORD = 'Demo2026Forte';
const DOMAIN = 'bucketegg.demo';
const WAREHOUSE = { lat: -25.9692, lng: 32.5732 }; // armazém na Baixa
const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s] ${msg}`);

async function api(path, { token, method = 'GET', body, form } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const login = async (email) => (await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } })).access_token;
const pick = (arr, i) => arr[i % arr.length];

// ── 1. Dono, organização e equipa ─────────────────────────────────────────────
const ownerEmail = `dono@${DOMAIN}`;
let owner;
try {
  owner = (await api('/auth/register', {
    method: 'POST',
    body: { email: ownerEmail, password: PASSWORD, name: 'Zeneen Dono', organizationName: 'BucketEgg Distribuição' },
  })).access_token;
} catch (e) {
  if (!String(e.message).includes('409')) throw e;
  console.error('A demonstração já existe nesta base de dados (dono@bucketegg.demo). Nada a fazer.');
  process.exit(0);
}
await api('/organizations/current', { token: owner, method: 'PATCH', body: { timezone: 'Africa/Maputo', currency: 'MZN', geofenceRadiusM: 150 } });
log('Organização "BucketEgg Distribuição" criada');

const people = [
  ['ana.machava', 'Ana Machava', 'MANAGER'],
  ['carlos.tembe', 'Carlos Tembe', 'MANAGER'],
  ['ines.cossa', 'Inês Cossa', 'ANALYST'],
  ['joao.mabunda', 'João Mabunda', 'FIELD_REP'],
  ['maria.sitoe', 'Maria Sitoe', 'FIELD_REP'],
  ['pedro.nhantumbo', 'Pedro Nhantumbo', 'FIELD_REP'],
  ['rita.chissano', 'Rita Chissano', 'FIELD_REP'],
  ['tomas.muianga', 'Tomás Muianga', 'FIELD_REP'],
  ['luisa.bila', 'Luísa Bila', 'FIELD_REP'],
];
const team = {};
for (const [handle, name, role] of people) {
  const m = await api('/team', {
    token: owner,
    method: 'POST',
    body: { email: `${handle}@${DOMAIN}`, password: PASSWORD, name, role, phone: `+25884${String(1000000 + Object.keys(team).length * 13579).slice(0, 7)}` },
  });
  team[handle] = { membershipId: m.id, userId: m.user.id, name, role };
}
// Supervisores: Ana supervisiona 3 promotores, Carlos os outros 3.
const reps = people.filter((p) => p[2] === 'FIELD_REP').map((p) => p[0]);
for (const [i, rep] of reps.entries()) {
  await api(`/team/${team[rep].membershipId}`, {
    token: owner,
    method: 'PATCH',
    body: { supervisorIds: [team[i < 3 ? 'ana.machava' : 'carlos.tembe'].membershipId] },
  });
}
for (const handle of Object.keys(team)) team[handle].token = await login(`${handle}@${DOMAIN}`);
log(`Equipa: ${people.length} membros (2 supervisores, 1 analista, ${reps.length} promotores)`);

// ── 2. Projetos ───────────────────────────────────────────────────────────────
const project = await api('/projects', {
  token: owner,
  method: 'POST',
  body: { name: 'Distribuição Maputo', category: 'Bebidas', description: 'Venda e reposição no retalho tradicional de Maputo e Matola' },
});
const audit = await api('/projects', {
  token: owner,
  method: 'POST',
  body: { name: 'Auditoria de Prateleira', category: 'Trade marketing', description: 'Visibilidade, preços e validade nos pontos de venda' },
});
log('Projetos: Distribuição Maputo, Auditoria de Prateleira');

// ── 3. Lojas (bairros reais; coordenadas aproximadas) ─────────────────────────
const places = [
  ['Baixa', -25.9692, 32.5732], ['Polana Cimento', -25.9655, 32.5932], ['Sommerschield', -25.953, 32.589],
  ['Alto Maé', -25.9645, 32.5745], ['Malhangalene', -25.9545, 32.5785], ['Xipamanine', -25.9497, 32.5622],
  ['Museu', -25.9625, 32.5865], ['Coop', -25.9493, 32.5852], ['Costa do Sol', -25.918, 32.6135],
  ['Maxaquene', -25.9415, 32.5885], ['Mafalala', -25.946, 32.574], ['Chamanculo', -25.946, 32.555],
  ['Matola Rio', -25.9622, 32.4589], ['Machava', -25.9195, 32.507], ['Zimpeto', -25.857, 32.556],
];
const channels = ['Mercearia', 'Supermercado', 'Bar', 'Restaurante', 'Barraca', 'Bottle store'];
const prefixes = { Mercearia: 'Mercearia', Supermercado: 'Supermercado', Bar: 'Bar', Restaurante: 'Restaurante', Barraca: 'Barraca', 'Bottle store': 'Bottle Store' };
const owners = ['Tio Zé', 'Dona Amélia', 'Central', 'Boa Esperança', 'Estrela', 'Paz', 'Kanimambo', 'Avenida', 'Maré Alta', 'Bom Preço', 'Sol Nascente', 'Família', 'Esquina', 'Sabor', 'Vitória'];
const outlets = [];
for (let i = 0; i < 36; i++) {
  const [zone, lat, lng] = pick(places, i);
  const channel = pick(channels, i * 7 + 3);
  const jitter = (n) => ((((i * 9301 + n * 49297) % 233280) / 233280) - 0.5) * 0.008;
  const o = await api(`/projects/${project.id}/outlets`, {
    token: owner,
    method: 'POST',
    body: {
      name: `${prefixes[channel]} ${pick(owners, i * 3 + 1)} ${zone}`,
      code: `MPT-${String(i + 1).padStart(4, '0')}`,
      address: `Bairro ${zone}, Maputo`,
      phone: `+25882${String(3000000 + i * 7919).slice(0, 7)}`,
      contactName: pick(['Sr. Matsinhe', 'Sra. Cumbe', 'Sr. Langa', 'Sra. Nhaca', 'Sr. Guambe'], i),
      channel,
      outletClass: pick(['A', 'B', 'B', 'C'], i),
      visitFrequencyDays: pick([7, 7, 14, 3], i),
      latitude: Number((lat + jitter(1)).toFixed(6)),
      longitude: Number((lng + jitter(2)).toFixed(6)),
      potentialScore: Math.round((((i * 37) % 100) + 1) / 10) / 1,
      zone: lat < -25.93 ? (lng < 32.52 ? 'Matola' : 'KaMpfumo') : 'KaMaxakeni',
      creditLimit: pick([0, 5000, 15000, 30000], i),
      force: true,
    },
  });
  outlets.push(o);
}
// Duas lojas sem GPS e duas propostas por promotores (aguardam aprovação)
outlets.push(await api(`/projects/${project.id}/outlets`, { token: owner, method: 'POST', body: { name: 'Banca Mercado Central', channel: 'Barraca', zone: 'KaMpfumo', force: true } }));
await api(`/projects/${project.id}/outlets`, {
  token: team['joao.mabunda'].token,
  method: 'POST',
  body: { name: 'Mercearia Nova Esperança Hulene', channel: 'Mercearia', latitude: -25.9131, longitude: 32.5797, zone: 'KaMavota', force: true },
});
await api(`/projects/${project.id}/outlets`, {
  token: team['maria.sitoe'].token,
  method: 'POST',
  body: { name: 'Bar Kanimambo Laulane', channel: 'Bar', latitude: -25.9002, longitude: 32.6009, zone: 'KaMavota', force: true },
});
const auditOutlets = [];
for (let i = 0; i < 8; i++) {
  const [zone, lat, lng] = pick(places, i + 5);
  auditOutlets.push(
    await api(`/projects/${audit.id}/outlets`, {
      token: owner,
      method: 'POST',
      body: { name: `Supermercado ${pick(owners, i + 4)} ${zone}`, channel: 'Supermercado', latitude: lat + 0.002, longitude: lng - 0.002, zone, force: true },
    }),
  );
}
log(`Lojas: ${outlets.length} na distribuição (2 sem GPS... e 2 a aguardar aprovação), ${auditOutlets.length} na auditoria`);

// ── 4. Catálogo ───────────────────────────────────────────────────────────────
const catalog = [
  ['CC-330', 'Coca-Cola 330ml (lata)', 'Coca-Cola', 'Refrigerantes', 'CX24', 1150, true],
  ['CC-2L', 'Coca-Cola 2L', 'Coca-Cola', 'Refrigerantes', 'CX6', 780, true],
  ['FA-330', 'Fanta Laranja 330ml', 'Fanta', 'Refrigerantes', 'CX24', 1100, false],
  ['SP-330', 'Sprite 330ml', 'Sprite', 'Refrigerantes', 'CX24', 1100, false],
  ['2M-340', '2M 340ml', '2M', 'Cervejas', 'CX24', 1450, true],
  ['LA-340', 'Laurentina Preta 340ml', 'Laurentina', 'Cervejas', 'CX24', 1600, false],
  ['MA-550', 'Manica 550ml', 'Manica', 'Cervejas', 'CX12', 980, false],
  ['AV-500', 'Água Vumba 500ml', 'Vumba', 'Águas', 'CX12', 420, true],
  ['AV-1.5', 'Água Vumba 1,5L', 'Vumba', 'Águas', 'CX6', 390, false],
  ['CP-1L', 'Compal Pêssego 1L', 'Compal', 'Sumos', 'CX12', 1320, false],
  ['RB-250', 'Red Bull 250ml', 'Red Bull', 'Energéticas', 'CX24', 2350, false],
  ['SC-330', 'Schweppes Tónica 330ml', 'Schweppes', 'Refrigerantes', 'CX24', 1180, false],
];
const products = [];
for (const [sku, name, brand, category, unit, price, isMustSell] of catalog) {
  products.push(await api('/products', { token: owner, method: 'POST', body: { sku, name, brand, category, unit, price, taxRate: 16, isMustSell } }));
}
log(`Catálogo: ${products.length} produtos (IVA 16%, ${catalog.filter((c) => c[6]).length} obrigatórios)`);

// ── 5. Beats e rotas ──────────────────────────────────────────────────────────
const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo' }).format(new Date());
const weekday = new Date(`${todayIso}T00:00:00Z`).getUTCDay();
const tomorrowIso = new Date(Date.parse(`${todayIso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const withGps = outlets.filter((o) => o.latitude != null);
const beats = [];
for (const [i, rep] of reps.entries()) {
  const mine = withGps.filter((_, k) => k % reps.length === i).slice(0, 6);
  beats.push(
    await api(`/projects/${project.id}/beats`, {
      token: owner,
      method: 'POST',
      body: {
        name: `Beat ${team[rep].name.split(' ')[0]} — ${mine[0].zone}`,
        description: `Circuito semanal de ${team[rep].name}`,
        weekdays: [weekday, (weekday + 2) % 7, (weekday + 4) % 7],
        assigneeId: team[rep].userId,
        outletIds: mine.map((o) => o.id),
      },
    }),
  );
}
const day = await api(`/projects/${project.id}/beats/generate-day`, {
  token: owner,
  method: 'POST',
  body: { date: todayIso, startTime: '08:00', startLocation: WAREHOUSE },
});
await api(`/projects/${project.id}/beats/generate-day`, {
  token: team['ana.machava'].token,
  method: 'POST',
  body: { date: new Date(Date.parse(`${todayIso}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10), startLocation: WAREHOUSE },
});
await api('/routes/plan', {
  token: team['carlos.tembe'].token,
  method: 'POST',
  body: {
    projectId: project.id,
    assigneeId: team['luisa.bila'].userId,
    name: 'Rota especial — Matola',
    date: `${tomorrowIso}T07:30:00+02:00`,
    outletIds: withGps.filter((o) => o.zone === 'Matola').slice(0, 5).map((o) => o.id),
    startLocation: WAREHOUSE,
    serviceMinsPerStop: 20,
  },
});
log(`Beats: ${beats.length}; rotas de hoje: ${day.created.length} (+ rotas de amanhã e depois)`);

// ── 6. Execução no terreno: presenças, visitas, encomendas, cobranças ─────────
const working = reps.slice(0, 5); // um promotor faltou hoje
for (const rep of working) {
  await api('/attendance/clock-in', { token: team[rep].token, method: 'POST', body: { projectId: project.id, lat: WAREHOUSE.lat, lng: WAREHOUSE.lng } });
}
const mustSell = products.filter((p) => p.isMustSell);
let orders = 0;
let visits = 0;
for (const [r, rep] of working.entries()) {
  const myDay = await api(`/routes/my-day`, { token: team[rep].token });
  const stops = myDay.tasks.filter((t) => t.outlet.latitude != null).slice(0, 4 - (r % 2));
  for (const [s, task] of stops.entries()) {
    const far = r === 2 && s === 1; // uma visita fora do geofence
    const v = await api('/visits/check-in', {
      token: team[rep].token,
      method: 'POST',
      body: { outletId: task.outletId, taskId: task.id, lat: task.outlet.latitude + (far ? 0.01 : 0.0004), lng: task.outlet.longitude },
    });
    visits++;
    let sells = !far && (s + r) % 3 !== 2;
    if (sells) {
      const items = [pick(products, s + r), pick(products, s + r + 4), ...(s % 2 ? [] : [mustSell[r % mustSell.length]])]
        .filter((p, k, a) => a.findIndex((x) => x.id === p.id) === k)
        .map((p, k) => ({ productId: p.id, quantity: 1 + ((s + k + r) % 4), discountPct: k === 0 && s === 0 ? 5 : 0 }));
      try {
        await api('/orders', { token: team[rep].token, method: 'POST', body: { outletId: task.outletId, visitId: v.id, items, notes: s === 0 ? 'Entregar antes das 15h' : undefined } });
        orders++;
      } catch (e) {
        if (!String(e.message).includes('crédito')) throw e;
        sells = false; // limite de crédito excedido: a visita fica sem encomenda
      }
    }
    await api(`/visits/${v.id}/check-out`, {
      token: team[rep].token,
      method: 'POST',
      body: sells
        ? { notes: 'Visita concluída' }
        : { noOrderReason: far ? 'Loja fechada' : 'Stock suficiente ou crédito esgotado', notes: 'Sem encomenda hoje' },
    });
  }
}
// O 1.º promotor termina o dia
await api('/attendance/clock-out', { token: team[reps[0]].token, method: 'POST', body: { projectId: project.id, lat: WAREHOUSE.lat, lng: WAREHOUSE.lng } });
const allOrders = (await api(`/projects/${project.id}/orders?limit=100`, { token: owner })).data;
for (const [i, o] of allOrders.entries()) {
  if (i % 4 === 0) await api(`/orders/${o.id}/status`, { token: owner, method: 'PATCH', body: { status: 'CONFIRMED' } });
  if (i % 4 === 1) {
    await api(`/orders/${o.id}/status`, { token: owner, method: 'PATCH', body: { status: 'CONFIRMED' } });
    await api(`/orders/${o.id}/status`, { token: owner, method: 'PATCH', body: { status: 'DELIVERED' } });
  }
  if (i === 2) await api(`/orders/${o.id}/status`, { token: owner, method: 'PATCH', body: { status: 'CANCELLED' } });
}
const methods = ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD'];
for (const [i, o] of allOrders.slice(0, 5).entries()) {
  await api(`/outlets/${o.outletId}/payments`, {
    token: team[pick(working, i)].token,
    method: 'POST',
    body: { amount: Math.round(o.total * 0.6), method: pick(methods, i), reference: i % 2 ? `MPESA-${7700 + i}` : undefined },
  });
}
log(`Terreno: ${working.length} presenças, ${visits} visitas, ${orders} encomendas, 5 cobranças`);

// Ad-hoc e aprovação
await api(`/projects/${project.id}/tasks`, {
  token: team['ana.machava'].token,
  method: 'POST',
  body: { outletId: outlets[3].id, assigneeId: team['joao.mabunda'].userId, dueDate: todayIso, title: 'Recolher pagamento pendente', notes: 'Fatura de setembro' },
});
const pending = (await api(`/projects/${project.id}/outlets?status=PENDING_APPROVAL`, { token: owner })).data;
if (pending[0]) await api(`/outlets/${pending[0].id}/review`, { token: team['ana.machava'].token, method: 'POST', body: { status: 'ACTIVE' } });

// ── 7. Recolha de dados: formulário de auditoria ──────────────────────────────
const form = await api(`/projects/${audit.id}/forms`, {
  token: team['ana.machava'].token,
  method: 'POST',
  body: {
    name: 'Auditoria de prateleira — Outubro',
    fields: [
      { label: 'Produto visível na prateleira?', type: 'boolean' },
      { label: 'Nº de frentes (facings)', type: 'number' },
      { label: 'Preço Coca-Cola 330ml (MZN)', type: 'number' },
      { label: 'Data de validade mais próxima', type: 'date' },
      { label: 'Material promocional', type: 'string' },
      { label: 'Observações', type: 'string' },
    ],
  },
});
const cols = Object.keys(form.schema);
const records = [];
for (let i = 0; i < 24; i++) {
  const rep = pick(reps, i);
  const o = pick(auditOutlets, i);
  records.push(
    await api(`/datasets/${form.id}/records`, {
      token: team[rep].token,
      method: 'POST',
      body: {
        outletId: o.id,
        gpsLat: o.latitude,
        gpsLng: o.longitude,
        data: {
          [cols[0]]: i % 5 !== 0,
          [cols[1]]: 2 + (i % 7),
          [cols[2]]: 45 + (i % 4) * 2.5,
          [cols[3]]: `2026-${String(11 + (i % 2)).padStart(2, '0')}-${String(5 + i).padStart(2, '0')}`,
          [cols[4]]: pick(['Cartaz', 'Frigorífico de marca', 'Nenhum', 'Expositor'], i),
          [cols[5]]: pick(['Prateleira arrumada', 'Falta de stock de 2L', 'Preço acima do recomendado', 'Tudo conforme'], i),
        },
      },
    }),
  );
}
const first = records[0];
await api(`/datasets/${form.id}/records/${first.id}`, {
  token: team['ana.machava'].token,
  method: 'PATCH',
  body: { data: { [cols[2]]: 47.5 }, reason: 'Preço confirmado por fotografia', lastKnownUpdatedAt: first.updatedAt ?? undefined },
});
await api(`/datasets/${form.id}/records/${records[1].id}?reason=${encodeURIComponent('Registo duplicado')}`, { token: team['ines.cossa'].token, method: 'DELETE' });
log(`Formulário de auditoria com ${records.length} recolhas (1 corrigida, 1 removida)`);

// ── 8. Importações: lista de lojas e dataset de vendas (XLSX) ─────────────────
async function xlsx(header, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Folha1');
  ws.addRow(header);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function upload(token, kind, name, buffer, fileName) {
  const fd = new FormData();
  fd.append('projectId', project.id);
  fd.append('kind', kind);
  if (name) fd.append('name', name);
  fd.append('file', new Blob([buffer]), fileName);
  return api('/imports/upload', { token, method: 'POST', form: fd });
}
const outletFile = await xlsx(
  ['Código', 'Nome', 'Canal', 'Bairro', 'Latitude', 'Longitude', 'Telefone'],
  Array.from({ length: 12 }, (_, i) => [`IMP-${100 + i}`, `Mercearia Importada ${i + 1}`, 'Mercearia', 'Zimpeto', -25.86 + i * 0.002, 32.55 + i * 0.002, `+25884${5550000 + i}`]),
);
const salesFile = await xlsx(
  ['Data', 'Loja', 'Produto', 'Quantidade', 'Valor (MZN)', 'Promotor', 'Pago'],
  Array.from({ length: 300 }, (_, i) => [
    new Date(Date.UTC(2026, 8, 1 + (i % 30))),
    pick(outlets, i).name,
    pick(products, i).name,
    1 + (i % 9),
    Math.round(pick(products, i).price * (1 + (i % 9)) * 1.16),
    team[pick(reps, i)].name,
    i % 4 !== 0,
  ]),
);
const jobs = [
  await upload(owner, 'OUTLETS', undefined, outletFile, 'lojas-zimpeto.xlsx'),
  await upload(team['ines.cossa'].token, 'DATASET', 'Vendas de setembro', salesFile, 'vendas-setembro.xlsx'),
];
for (const job of jobs) {
  let j = job;
  for (let k = 0; k < 120 && ['QUEUED', 'PROCESSING'].includes(j.status); k++) {
    await new Promise((r) => setTimeout(r, 1000));
    j = await api(`/imports/${job.id}`, { token: owner });
  }
  log(`Importação ${j.fileName}: ${j.status} (${j.rowsProcessed} linhas)`);
}

console.log(`\nDemonstração pronta em ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
console.log(`Entrar com dono@${DOMAIN} / ${PASSWORD} (ou qualquer membro da equipa, mesma palavra-passe).`);
