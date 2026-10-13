import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LatLng, haversineMeters, optimizeStopOrder } from '../common/utils/geo.js';

export interface OptimizedRoute {
  /** Índices das paragens (input) na ordem de visita. */
  order: number[];
  /** Minutos de viagem até cada paragem, pela ordem de `order`. */
  legMins: number[];
  totalDistanceKm: number;
  totalTravelMins: number;
  optimizedBy: 'GOOGLE' | 'NEAREST_NEIGHBOUR';
}

/**
 * Google Routes API (substitui a Directions API, que a Google trata como "legado" e recusa em
 * projetos novos: "You're calling a legacy API, which is not enabled for your project").
 */
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
/** Só os campos usados (a Google exige a máscara e cobra pelo que é pedido). */
const FIELD_MASK = 'routes.optimizedIntermediateWaypointIndex,routes.legs.distanceMeters,routes.legs.duration';
/** Máximo de paragens intermédias por pedido (medido: 26 devolve 400 INVALID_ARGUMENT). */
export const GOOGLE_MAX_STOPS = 25;
/** Velocidade média urbana usada para estimar tempos sem Google. */
const FALLBACK_SPEED_KMH = 25;
/** Fator de correção linha reta -> estrada. */
const ROAD_FACTOR = 1.3;

interface GoogleLeg {
  distanceMeters?: number;
  duration?: string;
}

/** "1531s" -> 1531 (a Routes API devolve durações como texto em segundos). */
const seconds = (duration?: string) => {
  const n = Number.parseFloat(duration ?? '0');
  return Number.isFinite(n) ? n : 0;
};

@Injectable()
export class RouteOptimizerService {
  private readonly logger = new Logger(RouteOptimizerService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Ordena as paragens. Sem `end`, a rota regressa ao ponto de partida (igual nos dois motores,
   * para a distância total não depender de a Google estar disponível).
   */
  async optimize(stops: LatLng[], start?: LatLng, end?: LatLng): Promise<OptimizedRoute> {
    const finish = end ?? start;
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    // A Google precisa de origem definida e aceita no máximo 25 paragens; senão, otimizador local.
    if (apiKey && start && stops.length >= 1 && stops.length <= GOOGLE_MAX_STOPS) {
      try {
        return await this.optimizeWithGoogle(apiKey, stops, start, finish);
      } catch (e) {
        this.logger.warn(`Google Routes indisponível, a usar otimização local: ${describeError(e)}`);
      }
    }
    return this.optimizeLocally(stops, start, finish);
  }

  optimizeLocally(stops: LatLng[], start?: LatLng, end?: LatLng): OptimizedRoute {
    const { order, distanceM } = optimizeStopOrder(stops, start, end);
    const legMins: number[] = [];
    let prev = start;
    for (const i of order) {
      const km = prev ? (haversineMeters(prev, stops[i]) / 1000) * ROAD_FACTOR : 0;
      legMins.push(Math.round((km / FALLBACK_SPEED_KMH) * 60));
      prev = stops[i];
    }
    const totalDistanceKm = (distanceM / 1000) * ROAD_FACTOR;
    return {
      order,
      legMins,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      totalTravelMins: Math.round((totalDistanceKm / FALLBACK_SPEED_KMH) * 60),
      optimizedBy: 'NEAREST_NEIGHBOUR',
    };
  }

  private async optimizeWithGoogle(apiKey: string, stops: LatLng[], start: LatLng, end: LatLng): Promise<OptimizedRoute> {
    const point = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
    const { data } = await axios.post(
      ROUTES_URL,
      {
        origin: point(start),
        destination: point(end),
        intermediates: stops.map(point),
        travelMode: 'DRIVE',
        // Sem trânsito em tempo real: a rota é planeada com antecedência (e é o escalão mais barato).
        routingPreference: 'TRAFFIC_UNAWARE',
        // Com uma só paragem não há nada a ordenar (e a Google devolveria a ordem [-1]).
        optimizeWaypointOrder: stops.length > 1,
      },
      { headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK }, timeout: 10_000 },
    );

    // Sem caminho por estrada (ex.: ponto no mar ou numa ilha) a Google responde 200 com "{}".
    const route = data?.routes?.[0];
    const legs: GoogleLeg[] = route?.legs ?? [];
    if (legs.length !== stops.length + 1) throw new Error('a Google não encontrou rota por estrada entre os pontos');

    const order = validOrder(route.optimizedIntermediateWaypointIndex, stops.length);
    let meters = 0;
    let secs = 0;
    const legMins: number[] = [];
    legs.forEach((leg, i) => {
      // Campos a zero são omitidos na resposta (ex.: duas paragens no mesmo sítio).
      meters += leg.distanceMeters ?? 0;
      secs += seconds(leg.duration);
      // A última "leg" é a ida para o destino final, não uma paragem.
      if (i < stops.length) legMins.push(Math.round(seconds(leg.duration) / 60));
    });
    return {
      order,
      legMins,
      totalDistanceKm: Math.round(meters / 10) / 100,
      totalTravelMins: Math.round(secs / 60),
      optimizedBy: 'GOOGLE',
    };
  }
}

/** A ordem da Google tem de ser uma permutação de 0..n-1; senão, mantém a ordem recebida. */
function validOrder(raw: unknown, n: number): number[] {
  const identity = Array.from({ length: n }, (_, i) => i);
  if (!Array.isArray(raw) || raw.length !== n) return identity;
  const seen = new Set<number>();
  for (const v of raw) {
    if (!Number.isInteger(v) || v < 0 || v >= n || seen.has(v)) return identity;
    seen.add(v);
  }
  return raw as number[];
}

/** Mensagem útil sem nunca incluir a chave (vai no cabeçalho, não no URL). */
function describeError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const apiError = (e.response?.data as { error?: { status?: string; message?: string } } | undefined)?.error;
    if (apiError) return `HTTP ${e.response?.status} ${apiError.status ?? ''}: ${apiError.message ?? ''}`.trim();
    return e.code ? `${e.code}: ${e.message}` : e.message;
  }
  return (e as Error)?.message ?? String(e);
}
