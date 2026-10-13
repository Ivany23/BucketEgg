'use client';

import { Cpu, Crosshair, LocateFixed, Sparkles, Warehouse } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Button, Field, Input, cn, useToast } from '@/components/ui';
import { useApi } from '@/lib/query';
import { WEEKDAYS, type Member, type RouteSummary } from '@/lib/types';

/* ───────────────────────────── Constantes e utilitários ───────────────────────────── */

/** Armazém por omissão (Baixa de Maputo). */
export const WAREHOUSE = { lat: -25.9692, lng: 32.5732, label: 'Armazém (Baixa)' };

/** Máximo de lojas numa rota (limite da API). */
export const MAX_ROUTE_OUTLETS = 200;
/** A Google otimiza até 25 paragens quando há ponto de partida. */
export const GOOGLE_MAX_STOPS = 25;

/** "AAAA-MM-DD" + "HH:MM" em hora de Maputo → ISO com fuso (+02:00, sem hora de verão). */
export const maputoIso = (day: string, hhmm: string) => `${day}T${hhmm}:00+02:00`;

/** Cores de módulo usadas para dar uma cor diferente a cada passo/indicador. */
export const STEP_COLORS = [
  'var(--m-rotas)',
  'var(--m-beats)',
  'var(--m-lojas)',
  'var(--m-vendas)',
  'var(--m-dia)',
  'var(--m-dados)',
  'var(--m-visitas)',
];

/** Cor de cada dia da semana (0 = domingo). */
export const WEEKDAY_COLORS = [
  'var(--m-produtos)',
  'var(--m-rotas)',
  'var(--m-lojas)',
  'var(--m-beats)',
  'var(--m-vendas)',
  'var(--m-dia)',
  'var(--m-visitas)',
];

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Ocorreu um erro inesperado.');

/** Membros ativos da organização (para escolher o promotor). Só pedido por gestores. */
export function useTeam(enabled: boolean) {
  const q = useApi<Member[]>(['team'], enabled ? '/team' : null);
  const members = (q.data ?? []).filter((m) => m.isActive && m.user.isActive);
  // Promotores primeiro, depois os restantes (um supervisor também pode fazer uma rota).
  members.sort((a, b) => Number(b.role === 'FIELD_REP') - Number(a.role === 'FIELD_REP') || (a.user.name ?? '').localeCompare(b.user.name ?? ''));
  return { ...q, members };
}

export const memberLabel = (m: Member) => m.user.name ?? m.user.email;

/* ───────────────────────────── Etiquetas ───────────────────────────── */

export function OptimizerBadge({ by, className }: { by: RouteSummary['optimizedBy']; className?: string }) {
  if (!by) return null;
  if (by === 'GOOGLE') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
          'border-[color-mix(in_oklab,var(--m-visitas)_35%,transparent)] bg-[color-mix(in_oklab,var(--m-visitas)_14%,transparent)] text-[var(--m-visitas-text)]',
          className,
        )}
        title="Ordem das paragens otimizada pela Google Maps (Routes API)"
      >
        <Sparkles className="size-3.5" aria-hidden />
        Google Maps
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-ink-2',
        className,
      )}
      title="Ordem calculada no servidor (vizinho mais próximo + 2-opt)"
    >
      <Cpu className="size-3.5" aria-hidden />
      Otimizador local
    </span>
  );
}

/** Dias da semana (Dom..Sáb), ativos coloridos. */
export function WeekdayChips({ days, size = 'md' }: { days: number[]; size?: 'sm' | 'md' }) {
  const active = new Set(days);
  const label = days.length ? [...days].sort().map((d) => WEEKDAYS[d]).join(', ') : 'Sem dias definidos';
  return (
    <ul className="flex flex-wrap gap-1" aria-label={`Dias: ${label}`}>
      {WEEKDAYS.map((d, i) => {
        const on = active.has(i);
        return (
          <li
            key={d}
            aria-hidden
            className={cn(
              'inline-flex items-center justify-center rounded-lg font-bold',
              size === 'sm' ? 'h-6 min-w-8 px-1.5 text-[11px]' : 'h-7 min-w-10 px-2 text-xs',
              on ? 'text-[#10141c]' : 'bg-surface-2 text-ink-3',
            )}
            style={on ? { background: `color-mix(in oklab, ${WEEKDAY_COLORS[i]} 70%, white)` } : undefined}
          >
            {d}
          </li>
        );
      })}
    </ul>
  );
}

/** Alternadores dos dias da semana (formulário). */
export function WeekdayToggles({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const reduce = useReducedMotion();
  return (
    <div role="group" aria-label="Dias da semana" className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((d, i) => {
        const on = value.includes(i);
        return (
          <motion.button
            key={d}
            type="button"
            aria-pressed={on}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i].sort((a, b) => a - b))}
            className={cn(
              'h-10 min-w-12 rounded-xl border px-3 text-sm font-bold transition-colors',
              on ? 'border-transparent text-[#10141c]' : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2',
            )}
            style={on ? { background: `color-mix(in oklab, ${WEEKDAY_COLORS[i]} 70%, white)` } : undefined}
          >
            {d}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Cabeçalho de secção numerado, cada passo com a sua cor. */
export function StepTitle({ n, title, hint, children }: { n: number; title: string; hint?: ReactNode; children?: ReactNode }) {
  const color = STEP_COLORS[(n - 1) % STEP_COLORS.length];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <span
        aria-hidden
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-extrabold"
        style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Caixa de erro da API dentro de um formulário. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm font-medium text-bad">
      {errorText(error)}
    </p>
  );
}

/* ───────────────────────────── Localização ───────────────────────────── */

export interface LocationDraft {
  lat: string;
  lng: string;
}

export const warehouseDraft = (): LocationDraft => ({ lat: String(WAREHOUSE.lat), lng: String(WAREHOUSE.lng) });

/** Converte o rascunho em coordenadas (ou null se inválido/vazio). */
export function parseLocation(d: LocationDraft): { lat: number; lng: number } | null {
  if (!d.lat.trim() || !d.lng.trim()) return null;
  const lat = Number(d.lat.replace(',', '.'));
  const lng = Number(d.lng.replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export const isWarehouse = (d: LocationDraft) => {
  const p = parseLocation(d);
  return !!p && p.lat === WAREHOUSE.lat && p.lng === WAREHOUSE.lng;
};

/** Latitude/longitude editáveis + atalhos (armazém, GPS do browser). */
export function LocationFields({
  value,
  onChange,
  error,
  allowClear,
}: {
  value: LocationDraft;
  onChange: (v: LocationDraft) => void;
  error?: string | null;
  /** Localização opcional: mostra "Limpar". */
  allowClear?: boolean;
}) {
  const toast = useToast();
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Localização indisponível', 'Este browser não permite obter a localização.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
      },
      (err) => {
        setLocating(false);
        toast.error(
          'Não foi possível obter a localização',
          err.code === err.PERMISSION_DENIED ? 'Autorize o acesso à localização no browser.' : 'Tente de novo ao ar livre ou introduza as coordenadas.',
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };
  const empty = !value.lat.trim() && !value.lng.trim();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={isWarehouse(value) ? 'soft' : 'secondary'} icon={Warehouse} onClick={() => onChange(warehouseDraft())} aria-pressed={isWarehouse(value)}>
          {WAREHOUSE.label}
        </Button>
        <Button size="sm" variant="secondary" icon={LocateFixed} loading={locating} onClick={locate}>
          Usar a minha localização
        </Button>
        {allowClear && !empty ? (
          <Button size="sm" variant="ghost" icon={Crosshair} onClick={() => onChange({ lat: '', lng: '' })}>
            Limpar
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude" error={error}>
          {(a) => <Input {...a} inputMode="decimal" placeholder="-25.9692" value={value.lat} onChange={(e) => onChange({ ...value, lat: e.target.value })} />}
        </Field>
        <Field label="Longitude">
          {(a) => <Input {...a} inputMode="decimal" placeholder="32.5732" value={value.lng} onChange={(e) => onChange({ ...value, lng: e.target.value })} />}
        </Field>
      </div>
    </div>
  );
}

/** Mini indicador (ícone colorido + valor + rótulo), para resumos dentro de painéis. */
export function MiniStat({ icon: Icon, label, value, color }: { icon: typeof Cpu; label: string; value: ReactNode; color: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[15px] leading-tight font-extrabold text-ink tabular-nums">{value}</div>
        <div className="truncate text-[11px] font-semibold text-ink-3">{label}</div>
      </div>
    </div>
  );
}
