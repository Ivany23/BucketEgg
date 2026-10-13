import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { RouteOptimizerService } from '../src/routes/route-optimizer.service.js';
import { setupApp } from '../src/setup-app.js';

/**
 * Rotas e planeamento, de ponta a ponta, contra PostgreSQL real (base de TESTE).
 * Usa o otimizador local (sem Google) para os resultados serem determinísticos;
 * a Google Routes API real é testada em google-routes.e2e-spec.ts.
 * Organização no fuso Africa/Maputo (UTC+2) e um dia fixo no futuro.
 */
describe('Rotas e planeamento (e2e)', { timeout: 60_000 }, () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const uid = `r${Date.now().toString(36)}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const DAY = '2030-01-15'; // terça-feira (dia da semana 2)
  const NEXT_DAY = '2030-01-16';
  const WEEKDAY = 2;
  const START = { lat: -25.97, lng: 32.57 }; // armazém
  let ownerToken: string;
  let repToken: string;
  let rep2Token: string;
  let otherToken: string;
  let ownerId: string;
  let repId: string;
  let rep2Id: string;
  let projectId: string;
  let project2Id: string;
  const o: Record<string, string> = {}; // lojas por nome

  const plan = (body: Record<string, unknown>, token = ownerToken) =>
    http.post('/routes/plan').set(auth(token)).send({ projectId, assigneeId: repId, name: 'Rota', date: `${DAY}T06:00:00.000Z`, ...body });
  const outlet = async (name: string, extra: Record<string, unknown> = {}, pid = () => projectId) => {
    const res = await http
      .post(`/projects/${pid()}/outlets`)
      .set(auth(ownerToken))
      .send({ name: `Loja ${name}`, force: true, ...extra })
      .expect(201);
    o[name] = res.body.id;
    return res.body.id as string;
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

    const reg = await http
      .post('/auth/register')
      .send({ email: `dono-${uid}@test.com`, password: 'SenhaForte123', name: 'Dono', organizationName: 'Rotas Lda' })
      .expect(201);
    ownerToken = reg.body.access_token;
    ownerId = reg.body.user.id;
    const member = async (prefix: string) => {
      const res = await http
        .post('/team')
        .set(auth(ownerToken))
        .send({ email: `${prefix}-${uid}@test.com`, password: 'SenhaForte123', name: prefix, role: 'FIELD_REP' })
        .expect(201);
      const login = await http.post('/auth/login').send({ email: `${prefix}-${uid}@test.com`, password: 'SenhaForte123' }).expect(200);
      return { id: res.body.user.id as string, token: login.body.access_token as string };
    };
    ({ id: repId, token: repToken } = await member('rep'));
    ({ id: rep2Id, token: rep2Token } = await member('rep2'));
    const other = await http
      .post('/auth/register')
      .send({ email: `outra-${uid}@test.com`, password: 'SenhaForte123', organizationName: 'Outra Lda' })
      .expect(201);
    otherToken = other.body.access_token;

    projectId = (await http.post('/projects').set(auth(ownerToken)).send({ name: 'Sul' }).expect(201)).body.id;
    project2Id = (await http.post('/projects').set(auth(ownerToken)).send({ name: 'Norte' }).expect(201)).body.id;
    // Lojas numa linha a leste do armazém: a ordem ótima é A, C, B, D.
    await outlet('A', { latitude: -25.97, longitude: 32.58 });
    await outlet('B', { latitude: -25.97, longitude: 32.6 });
    await outlet('C', { latitude: -25.97, longitude: 32.59 });
    await outlet('D', { latitude: -25.97, longitude: 32.61 });
    await outlet('SemGPS');
    await outlet('Inativa', { latitude: -25.95, longitude: 32.6 });
    await http.patch(`/outlets/${o.Inativa}`).set(auth(ownerToken)).send({ status: 'INACTIVE' }).expect(200);
    await outlet('Norte1', { latitude: -25.9, longitude: 32.6 }, () => project2Id);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('Planear rota (POST /routes/plan)', () => {
    let routeId: string;

    it('ordena as lojas, deixa as sem GPS no fim e calcula ETA por paragem', async () => {
      const res = await plan({ name: 'Rota Leste', outletIds: [o.D, o.SemGPS, o.B, o.A, o.C], startLocation: START }).expect(201);
      routeId = res.body.id;
      expect(res.body.optimizedBy).toBe('NEAREST_NEIGHBOUR');
      expect(res.body.tasks.map((t: { outlet: { name: string } }) => t.outlet.name.replace('Loja ', ''))).toEqual(['A', 'C', 'B', 'D', 'SemGPS']);
      expect(res.body.tasks.map((t: { orderIndex: number }) => t.orderIndex)).toEqual([1, 2, 3, 4, 5]);
      // Sem destino, regressa ao armazém: ~4 km para leste e volta, ×1,3 (estrada) ≈ 10,4 km.
      expect(res.body.totalDistance).toBeGreaterThan(10);
      expect(res.body.totalDistance).toBeLessThan(11);
      expect([res.body.endLat, res.body.endLng]).toEqual([START.lat, START.lng]);
      // ETA: começa às 06:00Z, cada paragem soma viagem + 15 min de serviço; tudo crescente.
      const etas = res.body.tasks.map((t: { estArrival: string }) => new Date(t.estArrival).getTime());
      expect(etas[0]).toBeGreaterThanOrEqual(new Date(`${DAY}T06:00:00Z`).getTime());
      for (let i = 1; i < etas.length; i++) expect(etas[i] - etas[i - 1]).toBeGreaterThanOrEqual(15 * 60_000);
      expect(res.body.estimatedMins).toBeGreaterThanOrEqual(5 * 15);
      expect(res.body.tasks.every((t: { assigneeId: string; status: string }) => t.assigneeId === repId && t.status === 'PENDING')).toBe(true);
    });

    it('respeita destino e minutos por paragem', async () => {
      const end = { lat: -25.97, lng: 32.62 };
      const res = await plan({ outletIds: [o.A, o.B], startLocation: START, endLocation: end, serviceMinsPerStop: 30 }).expect(201);
      expect([res.body.endLat, res.body.endLng]).toEqual([end.lat, end.lng]);
      const [t1, t2] = res.body.tasks.map((t: { estArrival: string }) => new Date(t.estArrival).getTime());
      expect(t2 - t1).toBeGreaterThanOrEqual(30 * 60_000);
      // Só ida até ao destino (sem regresso): 32,57 -> 32,62 ≈ 5 km ×1,3 ≈ 6,5 km.
      expect(res.body.totalDistance).toBeGreaterThan(6);
      expect(res.body.totalDistance).toBeLessThan(7);
    });

    it('sem ponto de partida começa na 1.ª loja e termina na última da ordem otimizada', async () => {
      const res = await plan({ outletIds: [o.A, o.D, o.B, o.C] }).expect(201);
      const names = res.body.tasks.map((t: { outlet: { name: string } }) => t.outlet.name.replace('Loja ', ''));
      expect(names).toEqual(['A', 'C', 'B', 'D']);
      expect([res.body.startLat, res.body.startLng]).toEqual([-25.97, 32.58]);
      expect([res.body.endLat, res.body.endLng]).toEqual([-25.97, 32.61]);
    });

    it('valida lojas, datas e limites', async () => {
      const inactive = await plan({ outletIds: [o.A, o.Inativa] }).expect(400);
      expect(JSON.stringify(inactive.body.message)).toContain('Loja Inativa');
      await plan({ outletIds: [o.A, o.Norte1] }).expect(400); // loja de outro projeto
      const noGps = await plan({ outletIds: [o.SemGPS] }).expect(400);
      expect(noGps.body.message).toContain('GPS');
      await plan({ outletIds: [o.A, o.A] }).expect(400); // repetida
      await plan({ outletIds: [] }).expect(400);
      await plan({ outletIds: Array.from({ length: 201 }, () => crypto.randomUUID()) }).expect(400);
      await plan({ outletIds: [o.A], serviceMinsPerStop: 481 }).expect(400);
      await plan({ outletIds: [o.A], date: 'amanhã' }).expect(400);
      await plan({ outletIds: [o.A], startLocation: { lat: 95, lng: 0 } }).expect(400);
      await plan({ outletIds: [o.A], extra: 'campo' }).expect(400);
    });

    it('promotor, beat e projeto têm de ser desta organização', async () => {
      const outsider = (await http.get('/auth/me').set(auth(otherToken)).expect(200)).body.id;
      await plan({ outletIds: [o.A], assigneeId: outsider }).expect(400);
      await plan({ outletIds: [o.A], beatId: crypto.randomUUID() }).expect(400);
      await http
        .post('/routes/plan')
        .set(auth(otherToken))
        .send({ projectId, assigneeId: repId, name: 'Rota X', date: `${DAY}T06:00:00Z`, outletIds: [o.A] })
        .expect(404);
    });

    it('promotor não planeia rotas', async () => {
      await plan({ outletIds: [o.A] }, repToken).expect(403);
    });

    it('detalhe da rota: o promotor vê a sua, outro promotor não, outra organização não', async () => {
      const res = await http.get(`/routes/${routeId}`).set(auth(repToken)).expect(200);
      expect(res.body.tasks).toHaveLength(5);
      expect(res.body.tasks[0].outlet.name).toBe('Loja A');
      expect(res.body.assignee.id).toBe(repId);
      await http.get(`/routes/${routeId}`).set(auth(rep2Token)).expect(403);
      await http.get(`/routes/${routeId}`).set(auth(otherToken)).expect(404);
      await http.get('/routes/nao-e-uuid').set(auth(ownerToken)).expect(400);
    });
  });

  describe('Listar rotas e "o meu dia" (fuso da organização)', () => {
    it('lista por dia e por promotor, com nº de paragens e concluídas', async () => {
      const all = await http.get(`/projects/${projectId}/routes?date=${DAY}`).set(auth(ownerToken)).expect(200);
      expect(all.body.length).toBe(3);
      expect(all.body.find((r: { name: string }) => r.name === 'Rota Leste')).toMatchObject({ stops: 5, completed: 0 });
      const none = await http.get(`/projects/${projectId}/routes?date=${NEXT_DAY}`).set(auth(ownerToken)).expect(200);
      expect(none.body).toHaveLength(0);
      const byRep2 = await http.get(`/projects/${projectId}/routes?assigneeId=${rep2Id}`).set(auth(ownerToken)).expect(200);
      expect(byRep2.body).toHaveLength(0);
    });

    it('o promotor só vê as suas rotas', async () => {
      await plan({ name: 'Rota do rep2', outletIds: [o.A], assigneeId: rep2Id, startLocation: START }).expect(201);
      const mine = await http.get(`/projects/${projectId}/routes`).set(auth(rep2Token)).expect(200);
      expect(mine.body.map((r: { name: string }) => r.name)).toEqual(['Rota do rep2']);
      const repRoutes = await http.get(`/projects/${projectId}/routes`).set(auth(repToken)).expect(200);
      expect(repRoutes.body.every((r: { assigneeId: string }) => r.assigneeId === repId)).toBe(true);
    });

    it('"o meu dia" usa o dia de Maputo: uma rota às 00:30 de Maputo (22:30 UTC da véspera) é desse dia', async () => {
      const early = await plan({ name: 'Madrugada', outletIds: [o.B], date: `${NEXT_DAY}T00:30:00+02:00`, startLocation: START }).expect(201);
      expect(early.body.date).toBe(`${DAY}T22:30:00.000Z`);
      const next = await http.get(`/routes/my-day?date=${NEXT_DAY}`).set(auth(repToken)).expect(200);
      expect(next.body).toMatchObject({ date: NEXT_DAY, total: 1 });
      expect(next.body.tasks[0].route.name).toBe('Madrugada');
      const day = await http.get(`/routes/my-day?date=${DAY}`).set(auth(repToken)).expect(200);
      expect(day.body.date).toBe(DAY);
      expect(day.body.total).toBe(5 + 2 + 4); // as três rotas do rep nesse dia
      expect(day.body.tasks.some((t: { route: { name: string } }) => t.route.name === 'Madrugada')).toBe(false);
      const list = await http.get(`/projects/${projectId}/routes?date=${NEXT_DAY}`).set(auth(ownerToken)).expect(200);
      expect(list.body.map((r: { name: string }) => r.name)).toEqual(['Madrugada']);
    });

    it('"o meu dia" sem data é hoje em Maputo', async () => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo' }).format(new Date());
      const res = await http.get('/routes/my-day').set(auth(repToken)).expect(200);
      expect(res.body.date).toBe(today);
    });
  });

  describe('Tarefas avulsas (POST /projects/:id/tasks, PATCH /tasks/:id)', () => {
    let taskId: string;

    it('gestor cria tarefa para um dia; aparece no "meu dia" desse dia', async () => {
      const res = await http
        .post(`/projects/${projectId}/tasks`)
        .set(auth(ownerToken))
        .send({ outletId: o.C, assigneeId: repId, dueDate: '2030-02-01', title: 'Recolher pagamento' })
        .expect(201);
      taskId = res.body.id;
      expect(res.body.dueDate).toBe('2030-01-31T22:00:00.000Z'); // 00:00 de 1/2 em Maputo
      const day = await http.get('/routes/my-day?date=2030-02-01').set(auth(repToken)).expect(200);
      expect(day.body.tasks.map((t: { id: string }) => t.id)).toEqual([taskId]);
    });

    it('valida loja do projeto, promotor e permissões', async () => {
      await http
        .post(`/projects/${projectId}/tasks`)
        .set(auth(ownerToken))
        .send({ outletId: o.Norte1, assigneeId: repId, dueDate: '2030-02-01' })
        .expect(400);
      await http
        .post(`/projects/${projectId}/tasks`)
        .set(auth(repToken))
        .send({ outletId: o.C, assigneeId: repId, dueDate: '2030-02-01' })
        .expect(403);
    });

    it('promotor muda o estado da sua tarefa, mas não a reagenda nem mexe nas dos outros', async () => {
      const done = await http.patch(`/tasks/${taskId}`).set(auth(repToken)).send({ status: 'COMPLETED', notes: 'pago' }).expect(200);
      expect(done.body).toMatchObject({ status: 'COMPLETED', notes: 'pago' });
      await http.patch(`/tasks/${taskId}`).set(auth(repToken)).send({ dueDate: '2030-02-02' }).expect(403);
      await http.patch(`/tasks/${taskId}`).set(auth(rep2Token)).send({ status: 'MISSED' }).expect(403);
      await http.patch(`/tasks/${taskId}`).set(auth(otherToken)).send({ status: 'MISSED' }).expect(404);
      await http.patch(`/tasks/${taskId}`).set(auth(repToken)).send({ status: 'FEITO' }).expect(400);
    });

    it('gestor reagenda para outro dia', async () => {
      const res = await http.patch(`/tasks/${taskId}`).set(auth(ownerToken)).send({ dueDate: '2030-02-02' }).expect(200);
      expect(res.body.dueDate).toBe('2030-02-01T22:00:00.000Z');
      const day = await http.get('/routes/my-day?date=2030-02-02').set(auth(repToken)).expect(200);
      expect(day.body.total).toBe(1);
    });
  });

  describe('Apagar rota (DELETE /routes/:id)', () => {
    it('apaga a rota e as paragens pendentes; as já feitas ficam no histórico', async () => {
      const route = (await plan({ name: 'Apagar', outletIds: [o.A, o.B], startLocation: START, date: '2030-03-01T06:00:00Z' }).expect(201)).body;
      const [done, pending] = route.tasks;
      await http.patch(`/tasks/${done.id}`).set(auth(repToken)).send({ status: 'COMPLETED' }).expect(200);
      await http.delete(`/routes/${route.id}`).set(auth(repToken)).expect(403);
      await http.delete(`/routes/${route.id}`).set(auth(otherToken)).expect(404);
      expect((await http.delete(`/routes/${route.id}`).set(auth(ownerToken)).expect(200)).body).toEqual({ deleted: true });
      await http.get(`/routes/${route.id}`).set(auth(ownerToken)).expect(404);

      const day = await http.get('/routes/my-day?date=2030-03-01').set(auth(repToken)).expect(200);
      expect(day.body.tasks.map((t: { id: string }) => t.id)).toEqual([done.id]);
      expect(day.body.tasks[0]).toMatchObject({ status: 'COMPLETED', routeId: null });
      expect(day.body.tasks.some((t: { id: string }) => t.id === pending.id)).toBe(false);
    });
  });

  describe('Beats: rotas recorrentes', () => {
    let beatId: string;

    it('gera a rota de um beat à hora local indicada (07:30 em Maputo = 05:30 UTC)', async () => {
      beatId = (
        await http
          .post(`/projects/${projectId}/beats`)
          .set(auth(ownerToken))
          .send({ name: 'Beat Leste', weekdays: [WEEKDAY], assigneeId: repId, outletIds: [o.D, o.Inativa, o.A, o.C] })
          .expect(201)
      ).body.id;
      const res = await http
        .post(`/beats/${beatId}/generate-route`)
        .set(auth(ownerToken))
        .send({ date: '2030-04-02', startTime: '07:30', startLocation: START })
        .expect(201);
      expect(res.body.date).toBe('2030-04-02T05:30:00.000Z');
      expect(res.body.name).toBe('Beat Leste - 2030-04-02');
      expect(res.body.beatId).toBe(beatId);
      // A loja inativa do beat fica de fora.
      expect(res.body.tasks.map((t: { outlet: { name: string } }) => t.outlet.name.replace('Loja ', ''))).toEqual(['A', 'C', 'D']);
      expect(new Date(res.body.tasks[0].estArrival).getTime()).toBeGreaterThanOrEqual(new Date('2030-04-02T05:30:00Z').getTime());
    });

    it('não cria uma segunda rota do mesmo beat no mesmo dia (409 com o id da existente)', async () => {
      const again = await http
        .post(`/beats/${beatId}/generate-route`)
        .set(auth(ownerToken))
        .send({ date: '2030-04-02', startTime: '09:00', startLocation: START })
        .expect(409);
      expect(again.body.message).toBe('Este beat já tem uma rota para este dia.');
      expect(again.body.routeId).toBeDefined();
    });

    it('sem startTime começa às 08:00 de Maputo; startTime inválido é recusado', async () => {
      const res = await http.post(`/beats/${beatId}/generate-route`).set(auth(ownerToken)).send({ date: '2030-04-09' }).expect(201);
      expect(res.body.date).toBe('2030-04-09T06:00:00.000Z');
      for (const startTime of ['25:00', '8h', '07:60', '']) {
        await http.post(`/beats/${beatId}/generate-route`).set(auth(ownerToken)).send({ date: '2030-04-16', startTime }).expect(400);
      }
    });

    it('plano do dia: gera para os beats desse dia da semana, uma só vez', async () => {
      // Beat noutro dia da semana e beat sem lojas ativas
      await http
        .post(`/projects/${projectId}/beats`)
        .set(auth(ownerToken))
        .send({ name: 'Beat Quarta', weekdays: [3], assigneeId: repId, outletIds: [o.B] })
        .expect(201);
      const empty = (
        await http
          .post(`/projects/${projectId}/beats`)
          .set(auth(ownerToken))
          .send({ name: 'Beat Vazio', weekdays: [WEEKDAY], assigneeId: rep2Id, outletIds: [o.Inativa] })
          .expect(201)
      ).body.id;

      const day = await http
        .post(`/projects/${projectId}/beats/generate-day`)
        .set(auth(ownerToken))
        .send({ date: '2030-04-23', startLocation: START })
        .expect(201);
      expect(day.body).toMatchObject({ date: '2030-04-23', weekday: WEEKDAY });
      expect(day.body.created.map((c: { beatId: string }) => c.beatId)).toEqual([beatId]);
      expect(day.body.skipped).toEqual([{ beatId: empty, reason: 'O beat não tem lojas ativas.' }]);

      const again = await http.post(`/projects/${projectId}/beats/generate-day`).set(auth(ownerToken)).send({ date: '2030-04-23' }).expect(201);
      expect(again.body.created).toHaveLength(0);
      expect(again.body.skipped).toContainEqual({ beatId, reason: 'rota já existe' });

      const routes = await http.get(`/projects/${projectId}/routes?date=2030-04-23`).set(auth(ownerToken)).expect(200);
      expect(routes.body).toHaveLength(1);
      await http.post(`/projects/${projectId}/beats/generate-day`).set(auth(repToken)).send({ date: '2030-04-23' }).expect(403);
    });
  });

  describe('Fuso horário da organização', () => {
    it('só aceita fusos IANA válidos', async () => {
      await http.patch('/organizations/current').set(auth(ownerToken)).send({ timezone: 'Marte/Olympus' }).expect(400);
      const ok = await http.patch('/organizations/current').set(auth(ownerToken)).send({ timezone: 'Africa/Maputo' }).expect(200);
      expect(ok.body.timezone).toBe('Africa/Maputo');
    });
  });

  it('o dono pode ser o executor de uma rota', async () => {
    const res = await plan({ outletIds: [o.A], assigneeId: ownerId, startLocation: START, date: '2030-05-01T06:00:00Z' }).expect(201);
    expect(res.body.assigneeId).toBe(ownerId);
  });
});
