import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { GOOGLE_MAX_STOPS, RouteOptimizerService } from './route-optimizer.service.js';

const start = { lat: -25.9692, lng: 32.5732 };
const stops = [
  { lat: -25.9655, lng: 32.5832 },
  { lat: -25.953, lng: 32.589 },
  { lat: -25.962, lng: 32.4589 },
];
const optimizer = (key = 'chave-de-teste') =>
  new RouteOptimizerService({ get: (k: string) => (k === 'GOOGLE_MAPS_API_KEY' ? key : undefined) } as ConfigService);
/** Resposta real da Routes API para os 3 pontos acima (medida em 12/10/2026). */
const googleOk = {
  routes: [
    {
      optimizedIntermediateWaypointIndex: [2, 1, 0],
      legs: [
        { distanceMeters: 15525, duration: '1531s' },
        { distanceMeters: 17021, duration: '1779s' },
        { distanceMeters: 1885, duration: '363s' },
        { distanceMeters: 1796, duration: '437s' },
      ],
    },
  ],
};

describe('RouteOptimizerService', () => {
  let post: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    post = vi.spyOn(axios, 'post');
  });
  afterEach(() => vi.restoreAllMocks());

  it('usa a Google Routes API com a ordem, tempos e distâncias por estrada', async () => {
    post.mockResolvedValue({ data: googleOk });
    const r = await optimizer().optimize(stops, start);
    expect(r).toEqual({
      order: [2, 1, 0],
      legMins: [26, 30, 6], // 1531 s, 1779 s, 363 s (a 4.ª leg é o regresso)
      totalDistanceKm: 36.23,
      totalTravelMins: 69, // 4110 s no total = 68,5 min
      optimizedBy: 'GOOGLE',
    });
    const [url, body, opts] = post.mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    expect(url).toBe('https://routes.googleapis.com/directions/v2:computeRoutes');
    // Sem destino, regressa ao ponto de partida; a chave vai no cabeçalho, nunca no URL.
    expect(body).toMatchObject({ optimizeWaypointOrder: true, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' });
    expect(body.destination).toEqual(body.origin);
    expect(opts.headers['X-Goog-Api-Key']).toBe('chave-de-teste');
    expect(opts.headers['X-Goog-FieldMask']).toContain('routes.optimizedIntermediateWaypointIndex');
    expect(url).not.toContain('chave');
  });

  it('respeita o destino indicado', async () => {
    post.mockResolvedValue({ data: googleOk });
    const end = { lat: -25.9, lng: 32.6 };
    await optimizer().optimize(stops, start, end);
    const body = post.mock.calls[0][1] as { destination: unknown };
    expect(body.destination).toEqual({ location: { latLng: { latitude: -25.9, longitude: 32.6 } } });
  });

  it('uma só paragem: não pede otimização (a Google devolveria a ordem [-1])', async () => {
    post.mockResolvedValue({
      data: { routes: [{ optimizedIntermediateWaypointIndex: [-1], legs: [{ distanceMeters: 1000, duration: '120s' }, { duration: '130s' }] }] },
    });
    const r = await optimizer().optimize([stops[0]], start);
    expect((post.mock.calls[0][1] as { optimizeWaypointOrder: boolean }).optimizeWaypointOrder).toBe(false);
    // [-1] é ignorado; distância em falta (campo omitido) conta como 0.
    expect(r).toMatchObject({ order: [0], legMins: [2], totalDistanceKm: 1, optimizedBy: 'GOOGLE' });
  });

  it('sem rota por estrada (resposta "{}", ex.: ponto no mar) usa o otimizador local', async () => {
    post.mockResolvedValue({ data: {} });
    const r = await optimizer().optimize(stops, start);
    expect(r.optimizedBy).toBe('NEAREST_NEIGHBOUR');
    expect([...r.order].sort()).toEqual([0, 1, 2]);
  });

  it('erro da Google (chave inválida, 400/403) ou tempo esgotado usa o otimizador local', async () => {
    const err = new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.' } },
    });
    post.mockRejectedValueOnce(err).mockRejectedValueOnce(new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED'));
    expect((await optimizer().optimize(stops, start)).optimizedBy).toBe('NEAREST_NEIGHBOUR');
    expect((await optimizer().optimize(stops, start)).optimizedBy).toBe('NEAREST_NEIGHBOUR');
  });

  it('ordem inválida devolvida pela Google mantém a ordem recebida', async () => {
    const legs = googleOk.routes[0].legs;
    post.mockResolvedValue({ data: { routes: [{ optimizedIntermediateWaypointIndex: [0, 0, 1], legs }] } });
    expect((await optimizer().optimize(stops, start)).order).toEqual([0, 1, 2]);
  });

  it('nº de legs inesperado é tratado como falha (otimizador local)', async () => {
    post.mockResolvedValue({ data: { routes: [{ optimizedIntermediateWaypointIndex: [0, 1, 2], legs: [{ duration: '1s' }] }] } });
    expect((await optimizer().optimize(stops, start)).optimizedBy).toBe('NEAREST_NEIGHBOUR');
  });

  it(`mais de ${GOOGLE_MAX_STOPS} paragens, sem partida ou sem chave: não chama a Google`, async () => {
    const many = Array.from({ length: GOOGLE_MAX_STOPS + 1 }, (_, i) => ({ lat: -25.9 - i * 0.001, lng: 32.5 }));
    expect((await optimizer().optimize(many, start)).optimizedBy).toBe('NEAREST_NEIGHBOUR');
    expect((await optimizer().optimize(stops)).optimizedBy).toBe('NEAREST_NEIGHBOUR');
    expect((await optimizer('').optimize(stops, start)).optimizedBy).toBe('NEAREST_NEIGHBOUR');
    expect(post).not.toHaveBeenCalled();
  });

  it('otimizador local: ida e volta ao ponto de partida, como na Google', () => {
    const line = [{ lat: 0, lng: 0.01 }, { lat: 0, lng: 0.02 }];
    const o = { lat: 0, lng: 0 };
    const roundTrip = optimizer('').optimizeLocally(line, o, o);
    const oneWay = optimizer('').optimizeLocally(line, o);
    // 0,02° de longitude no equador ≈ 2,22 km; ×1,3 (estrada) ≈ 2,89 km só ida, ≈ 5,78 km ida e volta.
    expect(oneWay.totalDistanceKm).toBeCloseTo(2.89, 1);
    expect(roundTrip.totalDistanceKm).toBeCloseTo(5.78, 1);
    expect(roundTrip.order).toEqual([0, 1]);
  });

  it('optimize() sem destino conta o regresso no otimizador local', async () => {
    const line = [{ lat: 0, lng: 0.01 }, { lat: 0, lng: 0.02 }];
    const r = await optimizer('').optimize(line, { lat: 0, lng: 0 });
    expect(r.totalDistanceKm).toBeCloseTo(5.78, 1);
  });
});
