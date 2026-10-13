/** Formatação em português de Moçambique (moeda MZN, fuso de Maputo). */
const TZ = 'Africa/Maputo';
const LOCALE = 'pt-PT';

const moneyFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'MZN', maximumFractionDigits: 2 });
// Inteiros: sempre arredondados (também a meio de uma animação de contagem).
const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });

export const money = (v: number | null | undefined) => moneyFmt.format(v ?? 0);
export const int = (v: number | null | undefined) => intFmt.format(v ?? 0);
export const compact = (v: number | null | undefined) => compactFmt.format(v ?? 0);
export const pct = (v: number | null | undefined, digits = 0) =>
  `${((v ?? 0) * 100).toLocaleString(LOCALE, { maximumFractionDigits: digits })}%`;

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const date = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString(LOCALE, { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};
export const dateShort = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString(LOCALE, { timeZone: TZ, day: '2-digit', month: 'short' }) : '—';
};
export const time = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d ? d.toLocaleTimeString(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—';
};
export const dateTime = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d
    ? d.toLocaleString(LOCALE, { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
};

/** "AAAA-MM-DD" de hoje (ou daqui a `offsetDays`) em Maputo. */
export function todayIso(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  if (!offsetDays) return today;
  return new Date(Date.parse(`${today}T00:00:00Z`) + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Há quanto tempo ("há 5 min", "há 2 dias"). */
export function ago(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return 'nunca';
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  if (Math.abs(diff) < 60) return 'agora mesmo';
  if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86_400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86_400), 'day');
}

export const minutes = (m: number | null | undefined) => {
  const v = Math.round(m ?? 0);
  if (v < 60) return `${v} min`;
  return `${Math.floor(v / 60)} h ${String(v % 60).padStart(2, '0')}`;
};

export const km = (v: number | null | undefined) => `${(v ?? 0).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} km`;

export const initials = (name?: string | null, email?: string | null) => {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
};

export const bytes = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  if (v < 1024) return `${v} B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)} MB`;
  return `${(v / 1024 ** 3).toFixed(2)} GB`;
};
