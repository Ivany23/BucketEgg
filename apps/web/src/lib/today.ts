'use client';

import { useSyncExternalStore } from 'react';
import { todayIso } from './format';

// Reavalia a cada minuto: um separador aberto passa sozinho para o dia seguinte à meia-noite.
const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 60_000);
  return () => clearInterval(t);
};
const getToday = () => todayIso();
// Na pré-renderização não existe "hoje" (seria congelado no dia do build): null.
const getServerToday = () => null;

/** Dia de hoje em Maputo ("AAAA-MM-DD"); null durante a pré-renderização no servidor. */
export function useToday(): string | null {
  return useSyncExternalStore(subscribe, getToday, getServerToday);
}

/** Soma dias a "AAAA-MM-DD" (sem depender da hora atual). */
export function addDays(day: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
