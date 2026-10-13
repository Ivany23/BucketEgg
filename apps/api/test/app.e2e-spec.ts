import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as xlsx from 'xlsx';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { RouteOptimizerService } from '../src/routes/route-optimizer.service.js';
import { setupApp } from '../src/setup-app.js';

/**
 * Fluxo completo da plataforma contra uma base de dados PostgreSQL real.
 * Requer DATABASE_URL a apontar para uma base de dados DE TESTE (é limpa no início).
 */
describe('Route-to-Market API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const uid = Date.now().toString(36);

  // Estado partilhado entre os passos do fluxo
  let ownerToken: string;
  let repToken: string;
  let otherOrgToken: string;
  let repUserId: string;
  let repMembershipId: string;
  let sup1Token: string;
  let sup2Token: string;
  let analystToken: string;
  let sup1MembershipId: string;
  let sup2MembershipId: string;
  let analystMembershipId: string;
  let projectId: string;
  const outletIds: string[] = [];
  let productId: string;
  let mustSellId: string;
  let beatId: string;
  let routeId: string;
  let visitId: string;
  let orderId: string;
  let formId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const today = new Date().toISOString().slice(0, 10);

  const xlsxBuffer = (rows: Record<string, unknown>[], bookType: xlsx.BookType = 'xlsx'): Buffer => {
    const wb = xlsx.utils.book_new();
    // UTC: datas escritas sem depender do fuso horário da máquina de testes
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows, { UTC: true }), 'Folha1');
    return xlsx.write(wb, { type: 'buffer', bookType });
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const binary = (res: any, cb: (err: Error | null, body: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  };

  /** Espera que uma importação em segundo plano termine e devolve o job final. */
  const waitForJob = async (jobId: string, token: string) => {
    for (let i = 0; i < 300; i++) {
      const res = await http.get(`/imports/${jobId}`).set(auth(token)).expect(200);
      if (!['QUEUED', 'PROCESSING'].includes(res.body.status)) return res.body;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Importação ${jobId} não terminou a tempo`);
  };

  beforeAll(async () => {
    // Otimizador local (sem Google): resultados exatos e sem custos. A Google é testada em google-routes.e2e-spec.ts.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RouteOptimizerService)
      .useValue(new RouteOptimizerService({ get: () => undefined } as unknown as ConfigService))
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());

    const prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe(
      'TRUNCATE organizations, users, products RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Saúde e documentação', () => {
    it('GET /health responde ok com a base de dados ligada', async () => {
      const res = await http.get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    });

    it('GET /docs/openapi.json expõe a especificação OpenAPI', async () => {
      const res = await http.get('/docs/openapi.json').expect(200);
      expect(res.body.openapi).toBeDefined();
      expect(Object.keys(res.body.paths)).toContain('/auth/register');
    });
  });

  describe('Autenticação e onboarding', () => {
    it('regista utilizador + organização numa só chamada', async () => {
      const res = await http
        .post('/auth/register')
        .send({ email: `Owner-${uid}@Test.com`, password: 'SenhaForte123', name: 'Ana', organizationName: 'Distribuidora Maputo' })
        .expect(201);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.needsOnboarding).toBe(false);
      expect(res.body.organization).toMatchObject({ name: 'Distribuidora Maputo', role: 'OWNER' });
      expect(res.body.user.email).toBe(`owner-${uid}@test.com`); // email normalizado
      ownerToken = res.body.access_token;
    });

    it('não guarda a palavra-passe em texto simples', async () => {
      const user = await app.get(PrismaService).user.findUnique({ where: { email: `owner-${uid}@test.com` } });
      expect(user.password).toMatch(/^\$2[aby]\$/);
    });

    it('rejeita email duplicado, senha fraca e campos extra', async () => {
      await http.post('/auth/register').send({ email: `owner-${uid}@test.com`, password: 'SenhaForte123' }).expect(409);
      await http.post('/auth/register').send({ email: `x-${uid}@test.com`, password: '123' }).expect(400);
      await http
        .post('/auth/register')
        .send({ email: `y-${uid}@test.com`, password: 'SenhaForte123', role: 'ADMIN' })
        .expect(400);
    });

    it('registo sem organização pede onboarding e depois cria organização', async () => {
      const reg = await http
        .post('/auth/register')
        .send({ email: `other-${uid}@test.com`, password: 'SenhaForte123' })
        .expect(201);
      expect(reg.body.needsOnboarding).toBe(true);
      await http.get('/projects').set(auth(reg.body.access_token)).expect(403);

      const org = await http
        .post('/organizations')
        .set(auth(reg.body.access_token))
        .send({ name: 'Concorrente Lda' })
        .expect(201);
      expect(org.body.session.organization.role).toBe('OWNER');
      otherOrgToken = org.body.session.access_token;
    });

    it('login com credenciais erradas devolve 401', async () => {
      await http.post('/auth/login').send({ email: `owner-${uid}@test.com`, password: 'errada' }).expect(401);
      await http.post('/auth/login').send({ email: `ninguem-${uid}@test.com`, password: 'errada' }).expect(401);
    });

    it('endpoints protegidos exigem token', async () => {
      await http.get('/auth/me').expect(401);
      await http.get('/auth/me').set(auth('token-invalido')).expect(401);
      const me = await http.get('/auth/me').set(auth(ownerToken)).expect(200);
      expect(me.body.memberships).toHaveLength(1);
      expect(me.body.password).toBeUndefined();
    });
  });

  describe('Equipa', () => {
    const addMember = async (prefix: string, role: string, extra: Record<string, unknown> = {}) => {
      const res = await http
        .post('/team')
        .set(auth(ownerToken))
        .send({ email: `${prefix}-${uid}@test.com`, password: 'SenhaForte123', name: prefix, role, ...extra })
        .expect(201);
      const login = await http
        .post('/auth/login')
        .send({ email: `${prefix}-${uid}@test.com`, password: 'SenhaForte123' })
        .expect(200);
      expect(login.body.organization.role).toBe(role);
      return { membershipId: res.body.id, userId: res.body.user.id, token: login.body.access_token, body: res.body };
    };

    it('OWNER adiciona dois supervisores e um analista de dados', async () => {
      const s1 = await addMember('sup1', 'MANAGER');
      const s2 = await addMember('sup2', 'MANAGER');
      const an = await addMember('analyst', 'ANALYST');
      [sup1Token, sup1MembershipId] = [s1.token, s1.membershipId];
      [sup2Token, sup2MembershipId] = [s2.token, s2.membershipId];
      [analystToken, analystMembershipId] = [an.token, an.membershipId];
    });

    it('um promotor pode ter mais de um supervisor', async () => {
      const rep = await addMember('rep', 'FIELD_REP', { supervisorIds: [sup1MembershipId, sup2MembershipId] });
      repUserId = rep.userId;
      repMembershipId = rep.membershipId;
      repToken = rep.token;
      expect(rep.body.supervisors.map((s: { id: string }) => s.id).sort()).toEqual(
        [sup1MembershipId, sup2MembershipId].sort(),
      );

      for (const token of [sup1Token, sup2Token]) {
        const mine = await http.get('/team/mine').set(auth(token)).expect(200);
        expect(mine.body.map((m: { id: string }) => m.id)).toContain(repMembershipId);
      }
    });

    it('MANAGER que adiciona um promotor fica automaticamente como supervisor', async () => {
      const res = await http
        .post('/team')
        .set(auth(sup1Token))
        .send({ email: `rep2-${uid}@test.com`, password: 'SenhaForte123', role: 'FIELD_REP' })
        .expect(201);
      expect(res.body.supervisors.map((s: { id: string }) => s.id)).toEqual([sup1MembershipId]);
    });

    it('valida supervisores: papel, auto-supervisão e ciclos', async () => {
      await http
        .patch(`/team/${sup2MembershipId}`)
        .set(auth(ownerToken))
        .send({ supervisorIds: [repMembershipId] })
        .expect(400); // FIELD_REP não pode supervisionar
      await http
        .patch(`/team/${sup2MembershipId}`)
        .set(auth(ownerToken))
        .send({ supervisorIds: [sup2MembershipId] })
        .expect(400); // não se supervisiona a si próprio
      await http
        .patch(`/team/${sup2MembershipId}`)
        .set(auth(ownerToken))
        .send({ supervisorIds: [sup1MembershipId] })
        .expect(200);
      await http
        .patch(`/team/${sup1MembershipId}`)
        .set(auth(ownerToken))
        .send({ supervisorIds: [sup2MembershipId] })
        .expect(400); // ciclo A<->B
    });

    it('MANAGER não pode alterar membros de papel superior nem analistas', async () => {
      await http.patch(`/team/${analystMembershipId}`).set(auth(sup1Token)).send({ isActive: false }).expect(403);
      await http.patch(`/team/${sup2MembershipId}`).set(auth(sup1Token)).send({ isActive: false }).expect(403);
      await http
        .post('/team')
        .set(auth(sup1Token))
        .send({ email: `x-${uid}@test.com`, password: 'SenhaForte123', role: 'ANALYST' })
        .expect(403);
    });

    it('FIELD_REP e ANALYST não podem gerir a equipa; FIELD_REP não cria projetos', async () => {
      await http.post('/team').set(auth(repToken)).send({ email: 'z@z.com', role: 'ADMIN' }).expect(403);
      await http.post('/team').set(auth(analystToken)).send({ email: 'z@z.com', role: 'FIELD_REP' }).expect(403);
      await http.post('/projects').set(auth(repToken)).send({ name: 'X' }).expect(403);
    });

    it('a última conta OWNER não pode ser despromovida', async () => {
      const team = await http.get('/team').set(auth(ownerToken)).expect(200);
      const owner = team.body.find((m: { role: string }) => m.role === 'OWNER');
      await http.patch(`/team/${owner.id}`).set(auth(ownerToken)).send({ role: 'ADMIN' }).expect(400);
    });
  });

  describe('Projetos e isolamento multi-tenant', () => {
    it('cria e lista projetos', async () => {
      const res = await http
        .post('/projects')
        .set(auth(ownerToken))
        .send({ name: 'Campanha Verão', category: 'Bebidas' })
        .expect(201);
      projectId = res.body.id;
      const list = await http.get('/projects').set(auth(ownerToken)).expect(200);
      expect(list.body).toHaveLength(1);
    });

    it('outra organização não vê nem acede ao projeto', async () => {
      const list = await http.get('/projects').set(auth(otherOrgToken)).expect(200);
      expect(list.body).toHaveLength(0);
      await http.get(`/projects/${projectId}`).set(auth(otherOrgToken)).expect(404);
      await http.get(`/projects/${projectId}/outlets`).set(auth(otherOrgToken)).expect(404);
      await http.get(`/organizations`).set(auth(otherOrgToken)).expect(200).expect((r) => {
        expect(r.body).toHaveLength(1);
        expect(r.body[0].name).toBe('Concorrente Lda');
      });
    });

    it('valida UUIDs nos parâmetros', async () => {
      await http.get('/projects/nao-e-uuid').set(auth(ownerToken)).expect(400);
    });
  });

  describe('Lojas (Outlets)', () => {
    const coords = [
      { name: 'Mercearia Central', latitude: -25.9655, longitude: 32.5832, phone: '+258 84 111 1111' },
      { name: 'Bottle Store Polana', latitude: -25.9700, longitude: 32.6000 },
      { name: 'Cantina Baixa', latitude: -25.9690, longitude: 32.5700 },
    ];

    it('cria lojas', async () => {
      for (const c of coords) {
        const res = await http
          .post(`/projects/${projectId}/outlets`)
          .set(auth(ownerToken))
          .send({ ...c, zone: 'Maputo', creditLimit: 100000 })
          .expect(201);
        expect(res.body.status).toBe('ACTIVE');
        outletIds.push(res.body.id);
      }
    });

    it('deteta duplicados por telefone e permite forçar', async () => {
      const res = await http
        .post(`/projects/${projectId}/outlets`)
        .set(auth(ownerToken))
        .send({ name: 'Outra Loja', phone: '841111111' })
        .expect(409);
      expect(res.body.duplicates[0].reasons).toContain('mesmo telefone');
    });

    it('loja criada por promotor fica pendente e o gestor aprova', async () => {
      const res = await http
        .post(`/projects/${projectId}/outlets`)
        .set(auth(repToken))
        .send({ name: 'Barraca Nova' })
        .expect(201);
      expect(res.body.status).toBe('PENDING_APPROVAL');
      await http.post(`/outlets/${res.body.id}/review`).set(auth(repToken)).send({ status: 'ACTIVE' }).expect(403);
      const ok = await http
        .post(`/outlets/${res.body.id}/review`)
        .set(auth(ownerToken))
        .send({ status: 'ACTIVE' })
        .expect(201);
      expect(ok.body.status).toBe('ACTIVE');
      outletIds.push(res.body.id); // loja sem GPS
    });

    it('pesquisa, pagina e encontra lojas próximas', async () => {
      const list = await http
        .get(`/projects/${projectId}/outlets?search=mercearia&limit=10`)
        .set(auth(ownerToken))
        .expect(200);
      expect(list.body.meta.total).toBe(1);

      const near = await http
        .get(`/projects/${projectId}/outlets/nearby?lat=-25.9655&lng=32.5832&radiusM=500`)
        .set(auth(ownerToken))
        .expect(200);
      expect(near.body[0].name).toBe('Mercearia Central');
      expect(near.body[0].distanceM).toBe(0);
    });

    it('lista lojas com visita em atraso', async () => {
      const res = await http.get(`/projects/${projectId}/outlets/overdue`).set(auth(ownerToken)).expect(200);
      expect(res.body.length).toBe(4);
    });

    it('deteta duplicados por nome parecido (índice trigram)', async () => {
      const res = await http
        .post(`/projects/${projectId}/outlets`)
        .set(auth(ownerToken))
        .send({ name: 'Mercearia Centrall' })
        .expect(409);
      expect(res.body.duplicates[0]).toMatchObject({ name: 'Mercearia Central', reasons: ['nome semelhante'] });
    });

    it('importa lojas de Excel em segundo plano', async () => {
      const buf = xlsxBuffer([
        { Nome: 'Importada 1', Codigo: 'ERP-1', Latitude: -25.95, Longitude: 32.58, Zona: 'Norte' },
        { Nome: 'Importada 2', Latitude: 'abc', Longitude: 32.59 },
        { Nome: '', Latitude: -25.9, Longitude: 32.5 },
        { Nome: 'Repetida', Codigo: 'erp-1' },
      ]);
      const res = await http
        .post('/imports/upload')
        .set(auth(ownerToken))
        .field('projectId', projectId)
        .field('kind', 'OUTLETS')
        .attach('file', buf, 'lojas.xlsx')
        .expect(202);
      expect(res.body).toMatchObject({ status: 'QUEUED', kind: 'OUTLETS', format: 'xlsx' });
      expect(res.body.storageKey).toBeUndefined();

      const job = await waitForJob(res.body.id, ownerToken);
      expect(job).toMatchObject({ status: 'COMPLETED', rowsProcessed: 1, rowsFailed: 3 });
      expect(job.rowErrors.map((e: { error: string }) => e.error)).toEqual([
        'latitude não é numérico',
        'nome em falta',
        'código "erp-1" já existe',
      ]);
    });

    it('só gestores importam lojas; promotores não importam nada', async () => {
      const buf = xlsxBuffer([{ Nome: 'X' }]);
      await http
        .post('/imports/upload')
        .set(auth(repToken))
        .field('projectId', projectId)
        .attach('file', buf, 'lojas.xlsx')
        .expect(403);
    });
  });

  describe('Catálogo', () => {
    it('cria produtos e rejeita SKU duplicado', async () => {
      const p = await http
        .post('/products')
        .set(auth(ownerToken))
        .send({ sku: 'COCA-330', name: 'Coca-Cola 330ml', price: 50, taxRate: 16 })
        .expect(201);
      productId = p.body.id;
      const msl = await http
        .post('/products')
        .set(auth(ownerToken))
        .send({ sku: 'AGUA-500', name: 'Água 500ml', price: 20, isMustSell: true })
        .expect(201);
      mustSellId = msl.body.id;
      await http.post('/products').set(auth(ownerToken)).send({ sku: 'COCA-330', name: 'Dup', price: 1 }).expect(409);
    });

    it('produtos de uma organização não aparecem noutra', async () => {
      const res = await http.get('/products').set(auth(otherOrgToken)).expect(200);
      expect(res.body.meta.total).toBe(0);
    });
  });

  describe('Planeamento: beats e rotas', () => {
    it('cria beat com lojas e promotor', async () => {
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      const res = await http
        .post(`/projects/${projectId}/beats`)
        .set(auth(ownerToken))
        .send({ name: 'Beat Centro', weekdays: [weekday], assigneeId: repUserId, outletIds })
        .expect(201);
      beatId = res.body.id;
      expect(res.body.outlets).toHaveLength(4);
    });

    it('não aceita promotor de outra organização', async () => {
      const other = await http.get('/auth/me').set(auth(otherOrgToken)).expect(200);
      await http
        .post(`/projects/${projectId}/beats`)
        .set(auth(ownerToken))
        .send({ name: 'Beat X', assigneeId: other.body.id })
        .expect(400);
    });

    it('gera as rotas do dia a partir dos beats agendados', async () => {
      const res = await http
        .post(`/projects/${projectId}/beats/generate-day`)
        .set(auth(ownerToken))
        .send({ date: today, startLocation: { lat: -25.9692, lng: 32.5732 } })
        .expect(201);
      expect(res.body.created).toHaveLength(1);
      expect(res.body.created[0].beatId).toBe(beatId);
      routeId = res.body.created[0].routeId;

      const again = await http
        .post(`/projects/${projectId}/beats/generate-day`)
        .set(auth(ownerToken))
        .send({ date: today })
        .expect(201);
      expect(again.body.skipped[0].reason).toBe('rota já existe');
    });

    it('a rota está otimizada e tem ETA por paragem', async () => {
      const res = await http.get(`/routes/${routeId}`).set(auth(repToken)).expect(200);
      expect(res.body.optimizedBy).toBe('NEAREST_NEIGHBOUR');
      expect(res.body.tasks).toHaveLength(4);
      expect(res.body.totalDistance).toBeGreaterThan(0);
      // Partindo de (-25.9692, 32.5732) a loja mais próxima é a Cantina Baixa
      expect(res.body.tasks[0].outlet.name).toBe('Cantina Baixa');
      // A loja sem GPS fica no fim
      expect(res.body.tasks[3].outlet.name).toBe('Barraca Nova');
      const etas = res.body.tasks.map((t: { estArrival: string }) => new Date(t.estArrival).getTime());
      expect([...etas].sort((a, b) => a - b)).toEqual(etas);
    });

    it('planeamento manual valida lojas do projeto', async () => {
      await http
        .post('/routes/plan')
        .set(auth(ownerToken))
        .send({
          projectId,
          assigneeId: repUserId,
          name: 'Inválida',
          date: new Date().toISOString(),
          outletIds: ['00000000-0000-4000-8000-000000000000'],
        })
        .expect(400);
    });

    it('o promotor vê o seu dia', async () => {
      const res = await http.get('/routes/my-day').set(auth(repToken)).expect(200);
      expect(res.body.total).toBe(4);
      expect(res.body.completed).toBe(0);
    });
  });

  describe('Execução: presenças, visitas e encomendas', () => {
    it('regista presença uma vez por dia', async () => {
      await http.post('/attendance/clock-in').set(auth(repToken)).send({ projectId, lat: -25.96, lng: 32.57 }).expect(201);
      await http.post('/attendance/clock-in').set(auth(repToken)).send({ projectId }).expect(409);
      const day = await http.get(`/projects/${projectId}/attendance`).set(auth(ownerToken)).expect(200);
      expect(day.body.present).toBe(1);
      expect(day.body.absent).toHaveLength(1); // o segundo promotor (rep2) não registou entrada
    });

    it('check-in dentro do geofence', async () => {
      const myDay = await http.get('/routes/my-day').set(auth(repToken)).expect(200);
      const first = myDay.body.tasks[0];
      const res = await http
        .post('/visits/check-in')
        .set(auth(repToken))
        .send({ outletId: first.outletId, taskId: first.id, lat: first.outlet.latitude + 0.0003, lng: first.outlet.longitude })
        .expect(201);
      expect(res.body.withinGeofence).toBe(true);
      expect(res.body.distanceM).toBeLessThan(50);
      visitId = res.body.id;
    });

    it('não permite duas visitas em simultâneo', async () => {
      await http
        .post('/visits/check-in')
        .set(auth(repToken))
        .send({ outletId: outletIds[0], lat: -25.96, lng: 32.58 })
        .expect(409);
    });

    it('sugere encomenda com produtos Must Sell', async () => {
      const visit = await http.get('/visits/active').set(auth(repToken)).expect(200);
      const res = await http.get(`/outlets/${visit.body.outletId}/suggested-order`).set(auth(repToken)).expect(200);
      expect(res.body.items.map((i: { productId: string }) => i.productId)).toContain(mustSellId);
    });

    it('regista encomenda com preços do catálogo e avisa sobre MSL em falta', async () => {
      const visit = await http.get('/visits/active').set(auth(repToken)).expect(200);
      const res = await http
        .post('/orders')
        .set(auth(repToken))
        .send({
          outletId: visit.body.outletId,
          visitId,
          items: [{ productId, quantity: 10, discountPct: 10 }],
        })
        .expect(201);
      // 10 x 50 = 500; -10% = 450; +16% IVA = 522
      expect(res.body).toMatchObject({ subtotal: 500, discount: 50, tax: 72, total: 522, number: 'ORD-000001' });
      expect(res.body.missingMustSell.map((p: { id: string }) => p.id)).toEqual([mustSellId]);
      orderId = res.body.id;
    });

    it('rejeita preço enviado pelo cliente e limite de crédito excedido', async () => {
      const visit = await http.get('/visits/active').set(auth(repToken)).expect(200);
      await http
        .post('/orders')
        .set(auth(repToken))
        .send({ outletId: visit.body.outletId, items: [{ productId, quantity: 1, unitPrice: 0.01 }] })
        .expect(400);
      const res = await http
        .post('/orders')
        .set(auth(repToken))
        .send({ outletId: visit.body.outletId, items: [{ productId, quantity: 5000 }] })
        .expect(400);
      expect(res.body.message).toContain('crédito');
    });

    it('check-out completa a tarefa e marca a visita como produtiva', async () => {
      const res = await http.post(`/visits/${visitId}/check-out`).set(auth(repToken)).send({ notes: 'ok' }).expect(201);
      expect(res.body.isProductive).toBe(true);
      expect(res.body.durationMins).toBeGreaterThanOrEqual(0);
      const myDay = await http.get('/routes/my-day').set(auth(repToken)).expect(200);
      expect(myDay.body.completed).toBe(1);
    });

    it('visita fora do geofence é sinalizada e exige motivo sem encomenda', async () => {
      const res = await http
        .post('/visits/check-in')
        .set(auth(repToken))
        .send({ outletId: outletIds[1], lat: -25.90, lng: 32.60 })
        .expect(201);
      expect(res.body.withinGeofence).toBe(false);
      await http.post(`/visits/${res.body.id}/check-out`).set(auth(repToken)).send({}).expect(400);
      await http
        .post(`/visits/${res.body.id}/check-out`)
        .set(auth(repToken))
        .send({ noOrderReason: 'Loja fechada' })
        .expect(201);
    });

    it('primeiro check-in numa loja sem GPS geo-referencia a loja', async () => {
      const noGps = outletIds[3];
      await http.post('/visits/check-in').set(auth(repToken)).send({ outletId: noGps, lat: -25.95, lng: 32.59 }).expect(201);
      const outlet = await http.get(`/outlets/${noGps}`).set(auth(ownerToken)).expect(200);
      expect(outlet.body.latitude).toBe(-25.95);
      const active = await http.get('/visits/active').set(auth(repToken)).expect(200);
      await http
        .post(`/visits/${active.body.id}/check-out`)
        .set(auth(repToken))
        .send({ noOrderReason: 'Sem stock' })
        .expect(201);
    });

    it('cobrança atualiza o saldo e o extrato', async () => {
      const order = await http.get(`/orders/${orderId}`).set(auth(ownerToken)).expect(200);
      const pay = await http
        .post(`/outlets/${order.body.outletId}/payments`)
        .set(auth(repToken))
        .send({ amount: 200, method: 'MOBILE_MONEY', reference: 'MPESA-1' })
        .expect(201);
      expect(pay.body.outletBalance).toBe(322);
      const st = await http.get(`/outlets/${order.body.outletId}/statement`).set(auth(ownerToken)).expect(200);
      expect(st.body).toMatchObject({ totalOrdered: 522, totalPaid: 200, balance: 322 });
    });

    it('fluxo de estados da encomenda', async () => {
      await http.patch(`/orders/${orderId}/status`).set(auth(repToken)).send({ status: 'CONFIRMED' }).expect(403);
      await http.patch(`/orders/${orderId}/status`).set(auth(ownerToken)).send({ status: 'CONFIRMED' }).expect(200);
      await http.patch(`/orders/${orderId}/status`).set(auth(ownerToken)).send({ status: 'SUBMITTED' }).expect(400);
      await http.patch(`/orders/${orderId}/status`).set(auth(ownerToken)).send({ status: 'DELIVERED' }).expect(200);
    });

    it('outra organização não acede à encomenda nem à loja', async () => {
      await http.get(`/orders/${orderId}`).set(auth(otherOrgToken)).expect(404);
      await http.get(`/outlets/${outletIds[0]}`).set(auth(otherOrgToken)).expect(404);
      await http
        .post('/visits/check-in')
        .set(auth(otherOrgToken))
        .send({ outletId: outletIds[0], lat: -25.96, lng: 32.58 })
        .expect(404);
    });
  });

  describe('Recolha de dados: auditor recolhe, supervisores/analistas corrigem', () => {
    let recordId: string;
    let otherRecordId: string;

    it('supervisor cria formulário; auditor submete recolha', async () => {
      const form = await http
        .post(`/projects/${projectId}/forms`)
        .set(auth(sup1Token))
        .send({ name: 'Auditoria de prateleira', fields: [{ label: 'Produto visível?', type: 'boolean' }, { label: 'Preço', type: 'number' }] })
        .expect(201);
      formId = form.body.id;
      await http.post(`/projects/${projectId}/forms`).set(auth(repToken)).send({ name: 'X', fields: [{ label: 'a' }] }).expect(403);

      const rec = await http
        .post(`/datasets/${formId}/records`)
        .set(auth(repToken))
        .send({ data: { col_0: true, col_1: 55 }, outletId: outletIds[0], gpsLat: -25.96, gpsLng: 32.58 })
        .expect(201);
      recordId = rec.body.id;
      expect(rec.body.submittedById).toBe(repUserId);

      const other = await http
        .post(`/datasets/${formId}/records`)
        .set(auth(analystToken))
        .send({ data: { col_0: false, col_1: 10 } })
        .expect(201);
      otherRecordId = other.body.id;
    });

    it('valida campos e tipos na recolha', async () => {
      await http.post(`/datasets/${formId}/records`).set(auth(repToken)).send({ data: { col_9: 1 } }).expect(400);
      const res = await http
        .post(`/datasets/${formId}/records`)
        .set(auth(repToken))
        .send({ data: { col_1: 'cinquenta' } })
        .expect(400);
      expect(res.body.errors[0]).toContain('esperado number');
    });

    it('o auditor NÃO pode editar, apagar, restaurar, ver histórico nem exportar', async () => {
      await http.patch(`/datasets/${formId}/records/${recordId}`).set(auth(repToken)).send({ data: { col_1: 1 } }).expect(403);
      await http.delete(`/datasets/${formId}/records/${recordId}`).set(auth(repToken)).expect(403);
      await http.post(`/datasets/${formId}/records/${recordId}/restore`).set(auth(repToken)).expect(403);
      await http.get(`/datasets/${formId}/records/${recordId}/history`).set(auth(repToken)).expect(403);
      await http.get(`/datasets/${formId}/download`).set(auth(repToken)).expect(403);
      await http.patch(`/datasets/${formId}/schema`).set(auth(repToken)).send({ fields: { col_0: { label: 'x' } } }).expect(403);
    });

    it('o auditor só vê as recolhas que ele próprio fez', async () => {
      const mine = await http.get(`/datasets/${formId}/records`).set(auth(repToken)).expect(200);
      expect(mine.body.canEdit).toBe(false);
      expect(mine.body.data.map((r: { id: string }) => r.id)).toEqual([recordId]);
      await http.get(`/datasets/${formId}/records?includeDeleted=true`).set(auth(repToken)).expect(403);

      const all = await http.get(`/datasets/${formId}/records`).set(auth(sup2Token)).expect(200);
      expect(all.body.canEdit).toBe(true);
      expect(all.body.meta.total).toBe(2);
    });

    it('supervisor corrige um campo; o resto mantém-se e fica no histórico', async () => {
      const res = await http
        .patch(`/datasets/${formId}/records/${recordId}`)
        .set(auth(sup1Token))
        .send({ data: { col_1: 65 }, reason: 'Preço mal digitado', lastKnownUpdatedAt: null })
        .expect(200);
      expect(res.body.data).toEqual({ col_0: true, col_1: 65 });
      expect(res.body.submittedById).toBe(repUserId); // autoria da recolha preservada
      expect(res.body.updatedAt).toBeTruthy();
    });

    it('dois supervisores em simultâneo: o segundo recebe 409 em vez de sobrescrever', async () => {
      // sup2 abriu o registo antes da correção do sup1 (updatedAt ainda era null)
      await http
        .patch(`/datasets/${formId}/records/${recordId}`)
        .set(auth(sup2Token))
        .send({ data: { col_1: 70 }, lastKnownUpdatedAt: null })
        .expect(409);

      // depois de recarregar, a correção é aceite
      const fresh = await http.get(`/datasets/${formId}/records`).set(auth(sup2Token)).expect(200);
      const current = fresh.body.data.find((r: { id: string }) => r.id === recordId);
      expect(current.updatedBy.id).toBeTruthy();
      await http
        .patch(`/datasets/${formId}/records/${recordId}`)
        .set(auth(sup2Token))
        .send({ data: { col_1: 70 }, lastKnownUpdatedAt: current.updatedAt })
        .expect(200);
    });

    it('analista também corrige; validação de tipos aplica-se às correções', async () => {
      await http
        .patch(`/datasets/${formId}/records/${recordId}`)
        .set(auth(analystToken))
        .send({ data: { col_0: 'sim' } })
        .expect(400);
      await http
        .patch(`/datasets/${formId}/records/${recordId}`)
        .set(auth(analystToken))
        .send({ data: { col_1: 75 }, reason: 'Confirmado por foto' })
        .expect(200);
    });

    it('histórico mostra quem alterou, valores antes/depois e motivo', async () => {
      const res = await http.get(`/datasets/${formId}/records/${recordId}/history`).set(auth(ownerToken)).expect(200);
      expect(res.body.submittedBy.id).toBe(repUserId);
      const revs = res.body.revisions;
      expect(revs).toHaveLength(3);
      expect(revs.map((r: { action: string }) => r.action)).toEqual(['UPDATE', 'UPDATE', 'UPDATE']);
      expect(revs[0]).toMatchObject({ reason: 'Preço mal digitado', previousData: { data: { col_1: 55 } }, newData: { data: { col_1: 65 } } });
      expect(revs[2].newData.data.col_1).toBe(75);
      expect(new Set(revs.map((r: { editedBy: { id: string } }) => r.editedBy.id)).size).toBe(3);
    });

    it('remoção lógica: sai das listas e da exportação, mas pode ser restaurado', async () => {
      await http.delete(`/datasets/${formId}/records/${otherRecordId}?reason=Duplicado`).set(auth(analystToken)).expect(200);
      await http.delete(`/datasets/${formId}/records/${otherRecordId}`).set(auth(analystToken)).expect(400);
      await http.patch(`/datasets/${formId}/records/${otherRecordId}`).set(auth(sup1Token)).send({ data: { col_1: 1 } }).expect(400);

      const visible = await http.get(`/datasets/${formId}/records`).set(auth(sup1Token)).expect(200);
      expect(visible.body.meta.total).toBe(1);
      const withDeleted = await http.get(`/datasets/${formId}/records?includeDeleted=true`).set(auth(sup1Token)).expect(200);
      expect(withDeleted.body.meta.total).toBe(2);

      await http.post(`/datasets/${formId}/records/${otherRecordId}/restore`).set(auth(sup2Token)).expect(201);
      const hist = await http.get(`/datasets/${formId}/records/${otherRecordId}/history`).set(auth(sup2Token)).expect(200);
      expect(hist.body.revisions.map((r: { action: string }) => r.action)).toEqual(['DELETE', 'RESTORE']);
      // volta a remover para o teste de exportação
      await http.delete(`/datasets/${formId}/records/${otherRecordId}`).set(auth(sup2Token)).expect(200);
    });

    it('só OWNER/ADMIN apagam um dataset definitivamente', async () => {
      await http.delete(`/datasets/${formId}`).set(auth(sup1Token)).expect(403);
      await http.delete(`/datasets/${formId}`).set(auth(analystToken)).expect(403);
    });

    it('exporta XLSX com labels atuais e sem registos removidos', async () => {
      await http
        .patch(`/datasets/${formId}/schema`)
        .set(auth(analystToken))
        .send({ fields: { col_1: { label: 'Preço (MZN)' } } })
        .expect(200);

      const file = await http
        .get(`/datasets/${formId}/download`)
        .set(auth(ownerToken))
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const wb = xlsx.read(file.body, { type: 'buffer' });
      const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      expect(rows).toEqual([{ 'Produto visível?': true, 'Preço (MZN)': 75 }]);
    });

    it('importa Excel como dataset e pagina por cursor', async () => {
      const buf = xlsxBuffer([
        { Loja: 'A', Vendas: 1, Data: new Date(Date.UTC(2026, 9, 1)), Ativa: true },
        { Loja: 'B', Vendas: 2, Data: new Date(Date.UTC(2026, 9, 2)), Ativa: false },
        { Loja: 'C', Vendas: 3, Data: new Date(Date.UTC(2026, 9, 3)), Ativa: true },
      ]);
      const res = await http
        .post('/imports/upload')
        .set(auth(analystToken))
        .field('projectId', projectId)
        .field('name', 'Vendas Outubro')
        .attach('file', buf, 'dados.xlsx')
        .expect(202);
      const job = await waitForJob(res.body.id, analystToken);
      expect(job).toMatchObject({ status: 'COMPLETED', rowsProcessed: 3 });

      const datasets = await http.get(`/datasets/project/${projectId}`).set(auth(analystToken)).expect(200);
      const ds = datasets.body.find((d: { id: string }) => d.id === job.datasetId);
      expect(ds).toMatchObject({ name: 'Vendas Outubro', status: 'READY', rowCount: 3 });
      // Tipos inferidos a partir dos valores
      expect(Object.values(ds.schema).map((f: { label: string; type: string }) => [f.label, f.type])).toEqual([
        ['Loja', 'string'],
        ['Vendas', 'number'],
        ['Data', 'date'],
        ['Ativa', 'boolean'],
      ]);

      const page1 = await http.get(`/datasets/${job.datasetId}/records?limit=2`).set(auth(analystToken)).expect(200);
      expect(page1.body.meta).toMatchObject({ total: 3, pages: 2 });
      expect(page1.body.data[0].data).toEqual({ col_0: 'A', col_1: 1, col_2: '2026-10-01', col_3: true });
      const cursor = page1.body.meta.nextCursor;
      expect(cursor).toBeTruthy();
      const page2 = await http
        .get(`/datasets/${job.datasetId}/records?limit=2&cursor=${cursor}`)
        .set(auth(analystToken))
        .expect(200);
      expect(page2.body.data.map((r: { data: { col_0: string } }) => r.data.col_0)).toEqual(['C']);
      expect(page2.body.meta.nextCursor).toBeNull();

      // Exportação CSV com ; (Excel em português) e datas preservadas
      const csv = await http
        .get(`/datasets/${job.datasetId}/download?format=csv&delimiter=semicolon`)
        .set(auth(analystToken))
        .buffer(true)
        .parse(binary)
        .expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.body.toString('utf8')).toBe(
        '\uFEFFLoja;Vendas;Data;Ativa\r\nA;1;2026-10-01;true\r\nB;2;2026-10-02;false\r\nC;3;2026-10-03;true\r\n',
      );

      // Exportação XLSX: as datas voltam a ser datas do Excel
      const file = await http
        .get(`/datasets/${job.datasetId}/download`)
        .set(auth(analystToken))
        .buffer(true)
        .parse(binary)
        .expect(200);
      const wb = xlsx.read(file.body, { type: 'buffer', cellDates: true });
      const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { UTC: true });
      expect(rows[0]).toMatchObject({ Loja: 'A', Vendas: 1, Ativa: true });
      expect((rows[0].Data as Date).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('importa CSV em Windows-1252 com ; e .xls antigo (BIFF8)', async () => {
      // CSV gravado pelo Excel em português: separador ; e acentos em Windows-1252
      const latin1 = Buffer.from('Província;Visitas\r\nInhambane;10\r\nNampula;"1;5"\r\n', 'latin1');
      const csvRes = await http
        .post('/imports/upload')
        .set(auth(ownerToken))
        .field('projectId', projectId)
        .attach('file', latin1, 'provincias.csv')
        .expect(202);
      const csvJob = await waitForJob(csvRes.body.id, ownerToken);
      expect(csvJob).toMatchObject({ status: 'COMPLETED', rowsProcessed: 2 });
      const csvRecs = await http.get(`/datasets/${csvJob.datasetId}/records`).set(auth(ownerToken)).expect(200);
      expect(csvRecs.body.schema.col_0.label).toBe('Província');
      expect(csvRecs.body.data.map((r: { data: unknown }) => r.data)).toEqual([
        { col_0: 'Inhambane', col_1: '10' },
        { col_0: 'Nampula', col_1: '1;5' },
      ]);

      const xls = xlsxBuffer(
        [
          { Codigo: 'X1', Qtd: 5, Validade: new Date(Date.UTC(2027, 0, 31)) },
          { Codigo: 'X2', Qtd: 7, Validade: new Date(Date.UTC(2027, 1, 28)) },
        ],
        'biff8',
      );
      expect(xls.subarray(0, 4).toString('hex')).toBe('d0cf11e0'); // é mesmo um .xls binário
      const xlsRes = await http
        .post('/imports/upload')
        .set(auth(ownerToken))
        .field('projectId', projectId)
        .attach('file', xls, 'antigo.xls')
        .expect(202);
      const xlsJob = await waitForJob(xlsRes.body.id, ownerToken);
      expect(xlsJob).toMatchObject({ status: 'COMPLETED', rowsProcessed: 2, format: 'xls' });
      const xlsRecs = await http.get(`/datasets/${xlsJob.datasetId}/records`).set(auth(ownerToken)).expect(200);
      expect(xlsRecs.body.data.map((r: { data: unknown }) => r.data)).toEqual([
        { col_0: 'X1', col_1: 5, col_2: '2027-01-31' },
        { col_0: 'X2', col_1: 7, col_2: '2027-02-28' },
      ]);
      expect(xlsRecs.body.schema.col_2.type).toBe('date');
    });

    it('rejeita formatos inválidos, ficheiros grandes e ficheiros corrompidos', async () => {
      await http
        .post('/imports/upload')
        .set(auth(ownerToken))
        .field('projectId', projectId)
        .attach('file', Buffer.from('%PDF-1.4'), 'documento.pdf')
        .expect(400);

      const big = Buffer.alloc(6 * 1024 * 1024, 'a'); // limite de teste: 5 MB
      await http
        .post('/imports/upload')
        .set(auth(ownerToken))
        .field('projectId', projectId)
        .attach('file', big, 'grande.csv')
        .expect(413);

      const broken = await http
        .post('/imports/upload')
        .set(auth(ownerToken))
        .field('projectId', projectId)
        .attach('file', Buffer.from('isto não é um excel'), 'falso.xlsx')
        .expect(202);
      const job = await waitForJob(broken.body.id, ownerToken);
      expect(job.status).toBe('FAILED');
      expect(job.error).toContain('não é um .xlsx válido');
      expect(job.datasetId).toBeNull(); // nenhum dataset meio importado fica para trás
      await http.post(`/imports/${job.id}/cancel`).set(auth(ownerToken)).expect(400);

      // Outra organização não vê a importação
      await http.get(`/imports/${job.id}`).set(auth(otherOrgToken)).expect(404);
    });

    it('upload direto (S3) não está disponível com armazenamento local', async () => {
      await http
        .post('/imports/presign')
        .set(auth(ownerToken))
        .send({ projectId, fileName: 'x.xlsx', fileSize: 1000 })
        .expect(400);
    });
  });

  describe('Dashboard', () => {
    it('gestor vê KPIs da equipa', async () => {
      const res = await http.get(`/projects/${projectId}/analytics/dashboard`).set(auth(ownerToken)).expect(200);
      expect(res.body.visits).toMatchObject({ total: 3, productive: 1, outsideGeofence: 1 });
      expect(res.body.visits.strikeRate).toBeCloseTo(33.3, 1);
      expect(res.body.sales).toMatchObject({ orders: 1, revenue: 522 });
      expect(res.body.collections.amount).toBe(200);
      expect(res.body.planVsActual).toMatchObject({ planned: 4, completed: 1 });
      expect(res.body.leaderboard[0].user.id).toBe(repUserId);
      expect(res.body.attendanceToday).toBe(1);
    });

    it('tendência de vendas por dia', async () => {
      const res = await http
        .get(`/projects/${projectId}/analytics/sales-trend?from=${today}&to=${today}`)
        .set(auth(ownerToken))
        .expect(200);
      expect(res.body).toEqual([{ date: today, orders: 1, revenue: 522 }]);
    });
  });

  describe('Concorrência', () => {
    it('encomendas simultâneas: números únicos e limite de crédito respeitado', async () => {
      const project = await http.post('/projects').set(auth(ownerToken)).send({ name: 'Carga' }).expect(201);
      const outlet = await http
        .post(`/projects/${project.body.id}/outlets`)
        .set(auth(ownerToken))
        .send({ name: 'Loja Carga', creditLimit: 1000 })
        .expect(201);
      // Coca-Cola 50 + 16% IVA = 58 por unidade; 3 unidades = 174. Cabem 5 encomendas em 1000 (870).
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          http
            .post('/orders')
            .set(auth(ownerToken))
            .send({ outletId: outlet.body.id, items: [{ productId, quantity: 3 }] }),
        ),
      );
      const ok = results.filter((r) => r.status === 201);
      expect(ok).toHaveLength(5);
      expect(results.filter((r) => r.status === 400)).toHaveLength(7);
      const numbers = ok.map((r) => r.body.number).sort();
      expect(numbers).toEqual(['ORD-000001', 'ORD-000002', 'ORD-000003', 'ORD-000004', 'ORD-000005']);
      const st = await http.get(`/outlets/${outlet.body.id}/statement`).set(auth(ownerToken)).expect(200);
      expect(st.body.balance).toBe(870);
    });
  });

  describe('Revogação de acesso', () => {
    it('membro desativado perde acesso imediatamente', async () => {
      await http.delete(`/team/${repMembershipId}`).set(auth(ownerToken)).expect(200);
      await http.get('/routes/my-day').set(auth(repToken)).expect(401);
    });
  });
});
