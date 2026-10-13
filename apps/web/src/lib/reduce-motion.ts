'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * "Reduzir movimento" sem erro de hidratação: no servidor e na hidratação devolve sempre false
 * (o HTML coincide) e só depois passa ao valor real do sistema.
 */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
