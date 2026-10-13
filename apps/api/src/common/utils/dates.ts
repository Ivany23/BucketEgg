import { BadRequestException } from '@nestjs/common';

const DAY_MS = 86_400_000;

/**
 * Converte "YYYY-MM-DD" (ou ISO) no intervalo [início, fim[ desse dia em UTC.
 * Sem valor, usa o dia atual.
 */
export function dayRange(value?: string | Date): { start: Date; end: Date } {
  const base = value ? new Date(value) : new Date();
  if (Number.isNaN(base.getTime())) throw new BadRequestException('Data inválida.');
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Fuso horário IANA válido (ex.: "Africa/Maputo"); se não for, UTC. */
export function safeTimeZone(timeZone?: string | null): string {
  if (!timeZone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/** Diferença (ms) entre a hora local do fuso e UTC no instante `ts`. */
function zoneOffsetMs(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Dia (YYYY-MM-DD) de um valor ISO; "YYYY-MM-DD" fica tal e qual, um instante é lido no fuso dado. */
function calendarDay(value: string | Date | undefined, timeZone: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida.');
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Instante UTC da hora local `HH:MM` do dia `YYYY-MM-DD` no fuso dado (ex.: 08:00 em Maputo = 06:00 UTC). */
export function zonedDateTime(day: string, time: string, timeZone: string): Date {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const local = Date.UTC(y, mo - 1, d, h, mi);
  let ts = local - zoneOffsetMs(local, timeZone);
  // Segunda passagem: acerta a hora se houver mudança de hora (verão/inverno) entre as duas estimativas.
  const second = zoneOffsetMs(ts, timeZone);
  ts = local - second;
  return new Date(ts);
}

/**
 * Intervalo [início, fim[ de um dia no fuso da organização. Aceita "YYYY-MM-DD" ou um instante ISO
 * (lido nesse fuso); sem valor, usa o dia de hoje nesse fuso.
 */
export function zonedDayRange(value: string | Date | undefined, timeZone: string): { day: string; start: Date; end: Date } {
  const tz = safeTimeZone(timeZone);
  const day = calendarDay(value, tz);
  const [y, m, d] = day.split('-').map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d) + DAY_MS).toISOString().slice(0, 10);
  return { day, start: zonedDateTime(day, '00:00', tz), end: zonedDateTime(nextDay, '00:00', tz) };
}

/** Dia de calendário no fuso, como guardado numa coluna DATE (meia-noite UTC desse dia). */
export function zonedCalendarDate(value: string | Date | undefined, timeZone: string): { day: string; date: Date } {
  const day = calendarDay(value, safeTimeZone(timeZone));
  return { day, date: new Date(`${day}T00:00:00.000Z`) };
}

/**
 * Intervalo [from, to] inclusivo por dias do fuso da organização; por defeito, os últimos 30 dias.
 * Devolve também a lista de dias (AAAA-MM-DD), para gráficos por dia.
 */
export function zonedPeriodRange(from: string | undefined, to: string | undefined, timeZone: string) {
  const tz = safeTimeZone(timeZone);
  const last = zonedDayRange(to, tz);
  const firstDay = from ? zonedDayRange(from, tz).day : new Date(Date.parse(`${last.day}T00:00:00Z`) - 29 * DAY_MS).toISOString().slice(0, 10);
  if (firstDay > last.day) throw new BadRequestException('"from" tem de ser anterior a "to".');
  const days: string[] = [];
  for (let d = Date.parse(`${firstDay}T00:00:00Z`); d <= Date.parse(`${last.day}T00:00:00Z`); d += DAY_MS) {
    days.push(new Date(d).toISOString().slice(0, 10));
  }
  return { start: zonedDateTime(firstDay, '00:00', tz), end: last.end, days, timeZone: tz };
}

/** Intervalo [from, to] inclusivo por dias UTC; por defeito, os últimos 30 dias. */
export function periodRange(from?: string, to?: string): { start: Date; end: Date } {
  const end = dayRange(to).end;
  const start = from ? dayRange(from).start : new Date(end.getTime() - 30 * DAY_MS);
  if (start >= end) throw new BadRequestException('"from" tem de ser anterior a "to".');
  return { start, end };
}
