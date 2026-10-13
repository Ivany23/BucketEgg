export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Ordena paragens pela heurística do vizinho mais próximo seguida de melhoria 2-opt.
 * Usado quando a Google Routes API não está disponível (sem chave, mais de 25 paragens, sem rota por estrada). Devolve os índices na ordem
 * de visita e a distância total em metros (em linha reta).
 */
export function optimizeStopOrder(
  stops: LatLng[],
  start?: LatLng,
  end?: LatLng,
): { order: number[]; distanceM: number } {
  if (stops.length === 0) return { order: [], distanceM: 0 };

  const remaining = new Set(stops.map((_, i) => i));
  const order: number[] = [];
  let current = start ?? stops[0];
  if (!start) {
    order.push(0);
    remaining.delete(0);
  }
  while (remaining.size) {
    let best = -1;
    let bestD = Infinity;
    for (const i of remaining) {
      const d = haversineMeters(current, stops[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    order.push(best);
    remaining.delete(best);
    current = stops[best];
  }

  const pathLength = (o: number[]) => {
    let total = 0;
    let prev = start;
    for (const i of o) {
      if (prev) total += haversineMeters(prev, stops[i]);
      prev = stops[i];
    }
    if (end && prev) total += haversineMeters(prev, end);
    return total;
  };

  // 2-opt: inverte segmentos enquanto houver melhoria
  let bestLen = pathLength(order);
  const firstMovable = start ? 0 : 1;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = firstMovable; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        const len = pathLength(candidate);
        if (len + 1e-6 < bestLen) {
          order.splice(0, order.length, ...candidate);
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return { order, distanceM: bestLen };
}
