'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

/** Só em demonstrações (NEXT_PUBLIC_DEMO_LOGIN=1): permite simular o GPS na loja num computador. */
export const DEMO_GPS = process.env.NEXT_PUBLIC_DEMO_LOGIN === '1';

export interface Coords {
  lat: number;
  lng: number;
  /** Precisão em metros (só quando vem do GPS). */
  accuracy?: number;
  simulated?: boolean;
}

export type GeoErrorKind = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class GeoError extends Error {
  constructor(readonly kind: GeoErrorKind) {
    super(GEO_MESSAGES[kind]);
    this.name = 'GeoError';
  }
}

export const GEO_MESSAGES: Record<GeoErrorKind, string> = {
  unsupported: 'Este dispositivo ou navegador não permite obter a localização.',
  denied: 'A localização está bloqueada. Autorize o acesso à localização nas definições do navegador e tente de novo.',
  unavailable: 'Não foi possível determinar a sua posição. Ligue o GPS, vá para um local aberto e tente de novo.',
  timeout: 'O GPS demorou demasiado a responder. Verifique se está ligado e tente de novo.',
};

/** Posição atual do GPS do navegador, com tempo-limite e erros em português. */
export function getPosition(timeoutMs = 15_000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new GeoError('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) reject(new GeoError('denied'));
        else if (e.code === e.TIMEOUT) reject(new GeoError('timeout'));
        else reject(new GeoError('unavailable'));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/** Estado "a obter localização" para mostrar no botão. */
export function useLocate() {
  const [locating, setLocating] = useState(false);
  const locate = useCallback(async (timeoutMs?: number) => {
    setLocating(true);
    try {
      return await getPosition(timeoutMs);
    } finally {
      setLocating(false);
    }
  }, []);
  return { locate, locating };
}

/* ───────── Relógio partilhado (cronómetros sem chamar Date.now() durante a renderização) ───────── */

let nowValue = Date.now();
const nowListeners = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;

function subscribeNow(cb: () => void) {
  nowListeners.add(cb);
  if (!nowTimer) {
    nowValue = Date.now();
    nowTimer = setInterval(() => {
      nowValue = Date.now();
      nowListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    nowListeners.delete(cb);
    if (!nowListeners.size && nowTimer) {
      clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}
const getNow = () => nowValue;
// No servidor (pré-renderização) não há "agora": 0 (os cronómetros só aparecem no browser).
const getServerNow = () => 0;

/** Hora atual (ms), atualizada a cada segundo enquanto houver quem a use. */
export function useNow(): number {
  return useSyncExternalStore(subscribeNow, getNow, getServerNow);
}

/** "12:05" ou "1:02:09" a partir de milissegundos. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Distância legível: "45 m" / "1,2 km". */
export function meters(m: number | null | undefined): string {
  if (m === null || m === undefined) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} km`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Desloca um dia "AAAA-MM-DD" (um dia vazio — ainda por calcular — fica vazio). */
export function shiftDay(day: string, days: number): string {
  if (!ISO_DAY.test(day)) return day;
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** "segunda-feira, 12 de outubro" para um dia "AAAA-MM-DD". */
export function longDay(day: string): string {
  if (!ISO_DAY.test(day)) return '';
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}
