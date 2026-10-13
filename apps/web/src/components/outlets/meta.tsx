'use client';

import { AlertTriangle, Gem } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useState } from 'react';
import { cn } from '@/components/ui';
import { money } from '@/lib/format';
import type { Outlet, OutletStatus } from '@/lib/types';

/* ───────────── Classe do cliente (A/B/C): uma cor por classe ───────────── */

interface ClassStyle {
  label: string;
  /** Cor sólida (marcadores no mapa — hex, porque o SVG do Leaflet não resolve var()). */
  hex: string;
  /** Cor do texto (AA) e fundo suave, a partir das cores dos módulos. */
  text: string;
  soft: string;
}

const CLASS_STYLE: Record<string, ClassStyle> = {
  A: { label: 'Classe A', hex: '#f59e0b', text: 'var(--m-dia-text)', soft: 'var(--m-dia-soft)' },
  B: { label: 'Classe B', hex: '#3b82f6', text: 'var(--m-rotas-text)', soft: 'var(--m-rotas-soft)' },
  C: { label: 'Classe C', hex: '#8b5cf6', text: 'var(--m-beats-text)', soft: 'var(--m-beats-soft)' },
};
const OTHER_CLASS: ClassStyle = { label: 'Sem classe', hex: '#94a3b8', text: 'var(--text-2)', soft: 'var(--surface-2)' };

export function classStyle(outletClass: string | null | undefined): ClassStyle {
  if (!outletClass) return OTHER_CLASS;
  return CLASS_STYLE[outletClass.toUpperCase()] ?? { ...OTHER_CLASS, label: `Classe ${outletClass}` };
}

export const CLASS_LEGEND = [...Object.values(CLASS_STYLE), OTHER_CLASS];

export function ClassBadge({ value }: { value: string | null | undefined }) {
  const s = classStyle(value);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
      style={{ background: s.soft, color: s.text }}
    >
      {value ? <Gem className="size-3.5" aria-hidden /> : null}
      {s.label}
    </span>
  );
}

/* ───────────── Estado da loja no mapa ───────────── */

export const STATUS_HEX: Record<OutletStatus, string> = {
  ACTIVE: '#22c55e',
  PENDING_APPROVAL: '#f97316',
  INACTIVE: '#94a3b8',
  REJECTED: '#ef4444',
};

/* ───────────── Saldo vs. limite de crédito ───────────── */

export function creditUsage(o: Pick<Outlet, 'balance' | 'creditLimit'>) {
  // Limite 0 = sem limite de crédito (regra da API): nunca está "acima do limite".
  const ratio = o.creditLimit > 0 ? Math.max(0, o.balance) / o.creditLimit : 0;
  return { ratio, warn: ratio > 0.8, over: ratio > 1 };
}

export function CreditBar({ outlet, compact }: { outlet: Pick<Outlet, 'balance' | 'creditLimit'>; compact?: boolean }) {
  const reduce = useReducedMotion();
  const { ratio, warn, over } = creditUsage(outlet);
  const pctValue = Number.isFinite(ratio) ? Math.min(100, ratio * 100) : 100;
  const color = over ? 'var(--bad)' : warn ? 'var(--warn)' : 'var(--accent)';
  // Limite 0 = sem limite de crédito (regra da API): não há nada a medir nem a alertar.
  if (outlet.creditLimit <= 0) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink-2 tabular-nums">{money(outlet.balance)}</span>
        <span className="text-ink-3">Sem limite de crédito</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink-2 tabular-nums">
          {money(outlet.balance)}
          {!compact ? <span className="font-normal text-ink-3"> de {money(outlet.creditLimit)}</span> : null}
        </span>
        {warn ? (
          <span className={cn('inline-flex items-center gap-1 font-semibold', over ? 'text-bad' : 'text-warn')}>
            <AlertTriangle className="size-3.5" aria-hidden />
            {over ? 'Acima do limite' : `${Math.round(ratio * 100)}%`}
          </span>
        ) : (
          <span className="text-ink-3">{`${Math.round(ratio * 100)}%`}</span>
        )}
      </div>
      <div
        role="meter"
        aria-label="Utilização do limite de crédito"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pctValue)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pctValue}%` }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

/* ───────────── Urgência do atraso de visita ───────────── */

export interface Urgency {
  label: string;
  color: string;
  soft: string;
}

/** Escala de urgência pelos dias de atraso (relativos à frequência alvo). */
export function urgencyFor(overdueDays: number, frequency: number): Urgency {
  const ratio = overdueDays / Math.max(1, frequency);
  if (overdueDays <= 1) return { label: 'Hoje', color: 'var(--info)', soft: 'var(--info-soft)' };
  if (ratio < 0.5) return { label: 'Ligeiro', color: 'var(--m-lojas-text)', soft: 'var(--m-lojas-soft)' };
  if (ratio < 1) return { label: 'Moderado', color: 'var(--warn)', soft: 'var(--warn-soft)' };
  if (ratio < 2) return { label: 'Alto', color: 'var(--m-painel-text)', soft: 'var(--m-painel-soft)' };
  return { label: 'Crítico', color: 'var(--bad)', soft: 'var(--bad-soft)' };
}

/* ───────────── Ligações (telefone e navegação) ───────────── */

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const directionsHref = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export const hasCoords = <T extends Pick<Outlet, 'latitude' | 'longitude'>>(o: T): o is T & { latitude: number; longitude: number } =>
  o.latitude != null && o.longitude != null;

/* ───────────── Localização do browser ───────────── */

export const DEMO_POSITION = { lat: -25.9692, lng: 32.5732 };
export const DEMO_LOGIN = process.env.NEXT_PUBLIC_DEMO_LOGIN === '1';

function geoErrorMessage(e: GeolocationPositionError | null): string {
  if (!e) return 'Este browser não permite obter a localização.';
  if (e.code === e.PERMISSION_DENIED)
    return 'Não autorizou o acesso à localização. Ative-o nas definições do browser (ícone do cadeado junto ao endereço) e tente de novo.';
  if (e.code === e.POSITION_UNAVAILABLE) return 'Não foi possível determinar a sua posição. Verifique se o GPS está ligado.';
  if (e.code === e.TIMEOUT) return 'O GPS demorou demasiado a responder. Vá para um local aberto e tente de novo.';
  return 'Não foi possível obter a localização.';
}

/** Pede a posição atual ao browser, com mensagens de erro em português. */
export function useGeolocation() {
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setError(geoErrorMessage(null));
        resolve(null);
        return;
      }
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError('A localização só funciona numa ligação segura (https).');
        resolve(null);
        return;
      }
      setLoading(true);
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
          setPosition(next);
          setLoading(false);
          resolve(next);
        },
        (e) => {
          setError(geoErrorMessage(e));
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
      );
    });
  }, []);

  const applyDemo = useCallback(() => {
    setError(null);
    setPosition(DEMO_POSITION);
  }, []);

  return { position, error, loading, request, applyDemo };
}

/** Distância legível ("120 m", "1,4 km"). */
export function distance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} km`;
}
