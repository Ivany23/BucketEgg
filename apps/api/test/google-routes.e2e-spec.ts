import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { haversineMeters } from '../src/common/utils/geo.js';
import { GOOGLE_MAX_STOPS, RouteOptimizerService } from '../src/routes/route-optimizer.service.js';
import { setupApp } from '../src/setup-app.js';

/**
 * Google Routes API REAL (usa GOOGLE_MAPS_API_KEY do .env; ~8 pedidos por execução).
 * Confirma o que a API devolve de facto, incluindo os casos-limite medidos em 12/10/2026.
 */
const fileEnv: Record<string, string | undefined> = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
const KEY = process.env.GOOGLE_MAPS_API_KEY || fileEnv.GOOGLE_MAPS_API_KEY;

describe.skipIf(!KEY)('Google Routes API (real)', { timeout: 60_000 }, () => {
  const config = (key: string | undefined) => ({ get: (k: string) => (k === 'GOOGLE_MAPS_API_KEY' ? key : undefined) }) as ConfigService;
  const google = new RouteOptimizerService(config(KEY));
  const warehouse = { lat: -25.9692, lng: 32.5732 }; // Baixa de Maputo
  const maputo = [
    { lat: -25.9655, lng: 32.5832 }, // Polana
    { lat: -25.953, lng: 32.589 }, // Sommerschield
    { lat: -25.962, lng: 32.4589 }, // Matola
  ];
  const isPermutation = (order: number[], n: number) => order.length === n && [...order].sort((a, b) => a - b).every((v, i) => v === i);

  describe('serviço de otimização', () => {
    it('3 lojas em Maputo: ordem, tempos e distâncias por estrada', async () => {
      const r = await google.optimize(maputo, warehouse);
      expect(r.optimizedBy).toBe('GOOGLE');
      expect(isPermutation(r.order, 3)).toBe(true);
      expect(r.legMins).toHaveLength(3);
      expect(r.legMins.every((m) => m >= 0)).toBe(true);
      // Por estrada, ida e volta, nunca menos do que em linha reta.
      let straight = 0;
      let prev = warehouse;
      for (const i of r.order) {
        straight += haversineMeters(prev, maputo[i]);
        prev = maputo[i];
      }
      straight += haversineMeters(prev, warehouse);
      expect(r.totalDistanceKm * 1000).toBeGreaterThanOrEqual(straight);
      expect(r.totalDistanceKm).toBeLessThan(80);
      expect(r.totalTravelMins).toBeGreaterThan(10);
    });

    it('1 loja (a Google devolveria a ordem [-1])', async () => {
      const r = await google.optimize([maputo[0]], warehouse);
      expect(r).toMatchObject({ optimizedBy: 'GOOGLE', order: [0] });
      expect(r.legMins).toHaveLength(1);
    });

    it(`${GOOGLE_MAX_STOPS} lojas (o máximo da Google)`, async () => {
      const stops = Array.from({ length: GOOGLE_MAX_STOPS }, (_, i) => ({
        lat: -25.96 - (i % 5) * 0.004,
        lng: 32.55 + Math.floor(i / 5) * 0.006,
      }));
      const r = await google.optimize(stops, warehouse);
      expect(r.optimizedBy).toBe('GOOGLE');
      expect(isPermutation(r.order, GOOGLE_MAX_STOPS)).toBe(true);
      expect(r.legMins).toHaveLength(GOOGLE_MAX_STOPS);
    });

    it(`${GOOGLE_MAX_STOPS + 1} lojas: otimizador local (a Google recusaria com 400)`, async () => {
      const stops = Array.from({ length: GOOGLE_MAX_STOPS + 1 }, (_, i) => ({ lat: -25.96 - i * 0.001, lng: 32.57 }));
      const r = await google.optimize(stops, warehouse);
      expect(r.optimizedBy).toBe('NEAREST_NEIGHBOUR');
      expect(isPermutation(r.order, GOOGLE_MAX_STOPS + 1)).toBe(true);
    });

    it('loja sem acesso por estrada (no mar): não falha, usa o otimizador local', async () => {
      const r = await google.optimize([maputo[0], { lat: -26.5, lng: 34.5 }], warehouse);
      expect(r.optimizedBy).toBe('NEAREST_NEIGHBOUR');
      expect(isPermutation(r.order, 2)).toBe(true);
    });

    it('chave inválida: não falha, usa o otimizador local', async () => {
      const r = await new RouteOptimizerService(config('AIzaSyINVALIDKEY000000000000000000000')).optimize(maputo, warehouse);
      expect(r.optimizedBy).toBe('NEAREST_NEIGHBOUR');
    });
  });

  describe('pela API (rota planeada e rota de beat)', () => {
    let app: INestApplication;
    let http: ReturnType<typeof request>;
    let token: string;
    let userId: string;
    let projectId: string;
    const outletIds: string[] = [];
    const uid = `g${Date.now().toString(36)}`;
    const auth = () => ({ Authorization: `Bearer ${token}` });

    beforeAll(async () => {
      process.env.GOOGLE_MAPS_API_KEY = KEY;
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = moduleRef.createNestApplication();
      setupApp(app);
      await app.init();
      http = request(app.getHttpServer());
      const reg = await http
        .post('/auth/register')
        .send({ email: `google-${uid}@test.com`, password: 'SenhaForte123', organizationName: 'Google Lda' })
        .expect(201);
      token = reg.body.access_token;
      userId = reg.body.user.id;
      projectId = (await http.post('/projects').set(auth()).send({ name: 'Maputo' }).expect(201)).body.id;
      for (const [i, p] of maputo.entries()) {
        const res = await http
          .post(`/projects/${projectId}/outlets`)
          .set(auth())
          .send({ name: `Loja ${i}`, latitude: p.lat, longitude: p.lng, force: true })
          .expect(201);
        outletIds.push(res.body.id);
      }
    }, 120_000);

    afterAll(async () => {
      await app?.close();
    });

    it('POST /routes/plan com ponto de partida usa a Google e grava ETA com os tempos dela', async () => {
      const res = await http
        .post('/routes/plan')
        .set(auth())
        .send({ projectId, assigneeId: userId, name: 'Rota Google', date: '2030-06-04T06:00:00Z', outletIds, startLocation: warehouse })
        .expect(201);
      expect(res.body.optimizedBy).toBe('GOOGLE');
      expect(res.body.tasks).toHaveLength(3);
      expect(res.body.totalDistance).toBeGreaterThan(10);
      // A ordem gravada é a que a Google devolve para os mesmos pontos.
      const direct = await google.optimize(maputo, warehouse);
      expect(res.body.tasks.map((t: { outletId: string }) => t.outletId)).toEqual(direct.order.map((i) => outletIds[i]));
      const etas = res.body.tasks.map((t: { estArrival: string }) => new Date(t.estArrival).getTime());
      for (let i = 1; i < etas.length; i++) expect(etas[i]).toBeGreaterThan(etas[i - 1]);
      expect(res.body.estimatedMins).toBe(direct.totalTravelMins + 15 * 3);
    });

    it('rota de beat gerada com partida também usa a Google', async () => {
      const beat = await http
        .post(`/projects/${projectId}/beats`)
        .set(auth())
        .send({ name: 'Beat Google', weekdays: [2], assigneeId: userId, outletIds })
        .expect(201);
      const res = await http
        .post(`/beats/${beat.body.id}/generate-route`)
        .set(auth())
        .send({ date: '2030-06-11', startTime: '07:00', startLocation: warehouse })
        .expect(201);
      expect(res.body.optimizedBy).toBe('GOOGLE');
      expect(res.body.date).toBe('2030-06-11T05:00:00.000Z'); // 07:00 em Maputo
    });
  });
});
