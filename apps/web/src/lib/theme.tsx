'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'bucketegg.theme';

/**
 * Corre antes da primeira pintura (inline no <head>) para não "piscar" o tema errado.
 * Sem escolha guardada, segue o sistema (o CSS trata disso com prefers-color-scheme).
 */
export const themeBootScript = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();
const read = (): ThemeChoice => {
  try {
    const t = window.localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
};

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => 'system' as ThemeChoice,
  );
  const setTheme = useCallback((t: ThemeChoice) => {
    try {
      if (t === 'system') window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, t);
    } catch {
      // sem armazenamento: só esta página
    }
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    listeners.forEach((l) => l());
  }, []);
  return { theme, setTheme };
}
