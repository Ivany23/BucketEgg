'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LocateFixed, MapPinOff, RefreshCw, ShoppingBag, ShoppingCart, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Button, Modal } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { Outlet, Visit } from '@/lib/types';
import { meters } from './geo';

/** Visita em curso: GET /visits/active traz a loja completa (com coordenadas). */
export type ActiveVisit = Visit & { outlet: Outlet };

/** Chaves de cache partilhadas pelos ecrãs de terreno. */
export const FIELD_KEYS = {
  active: ['visits', 'active'] as const,
};

/**
 * Visita em curso do utilizador (ou null). A API responde com corpo vazio quando não há visita,
 * por isso convertemos `undefined` em `null` (o React Query não aceita `undefined`).
 */
export function useActiveVisit() {
  return useQuery<ActiveVisit | null, ApiError>({
    queryKey: [...FIELD_KEYS.active],
    queryFn: async ({ signal }) => (await api<ActiveVisit | null>('/visits/active', { signal })) ?? null,
    refetchInterval: 30_000,
  });
}

export function GeofenceBadge({ within, distanceM }: { within: boolean; distanceM: number | null }) {
  return within ? (
    <Badge tone="ok" icon={LocateFixed}>
      Dentro{distanceM !== null ? ` · ${meters(distanceM)}` : ''}
    </Badge>
  ) : (
    <Badge tone="bad" icon={MapPinOff}>
      Fora{distanceM !== null ? ` · ${meters(distanceM)}` : ''}
    </Badge>
  );
}

export function ProductiveBadge({ productive, open }: { productive: boolean; open?: boolean }) {
  if (productive)
    return (
      <Badge tone="ok" icon={ShoppingCart}>
        Produtiva
      </Badge>
    );
  if (open)
    return (
      <Badge tone="info" icon={ShoppingBag}>
        Sem encomenda ainda
      </Badge>
    );
  return (
    <Badge tone="warn" icon={TriangleAlert}>
      Sem encomenda
    </Badge>
  );
}

/** Caixa de aviso/erro em linha (ícone + texto, nunca só cor). */
export function Notice({ tone, title, children, action }: { tone: 'warn' | 'bad' | 'ok' | 'info'; title: string; children?: ReactNode; action?: ReactNode }) {
  const styles = {
    warn: 'border-warn/30 bg-warn-soft text-warn',
    bad: 'border-bad/30 bg-bad-soft text-bad',
    ok: 'border-ok/30 bg-ok-soft text-ok',
    info: 'border-info/30 bg-info-soft text-info',
  }[tone];
  const Icon = tone === 'ok' ? CheckCircle2 : TriangleAlert;
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`flex gap-3 rounded-2xl border px-4 py-3 ${styles}`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">{title}</p>
        {children ? <div className="mt-1 text-ink-2">{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** Falha do GPS: explica o problema e oferece tentar de novo e alternativas. */
export function GpsFailModal({
  open,
  message,
  onClose,
  onRetry,
  retrying,
  fallbacks = [],
  module,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
  onRetry: () => void;
  retrying?: boolean;
  fallbacks?: { label: string; hint?: string; onClick: () => void }[];
  module?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      module={module}
      title="Não foi possível obter a localização"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" icon={RefreshCw} loading={retrying} onClick={onRetry}>
            Tentar de novo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-bad-soft text-bad">
            <MapPinOff className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-ink-2">{message}</p>
        </div>
        {fallbacks.length ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-line-strong p-3">
            {fallbacks.map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <Button variant="soft" icon={LocateFixed} onClick={f.onClick}>
                  {f.label}
                </Button>
                {f.hint ? <p className="text-xs text-ink-3">{f.hint}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** Cores dos módulos para dar uma cor diferente a cada passo. */
export const STEP_COLORS = [
  'var(--m-dia)',
  'var(--m-rotas)',
  'var(--m-beats)',
  'var(--m-lojas)',
  'var(--m-vendas)',
  'var(--m-visitas)',
  'var(--m-dados)',
  'var(--m-import)',
  'var(--m-equipa)',
  'var(--m-produtos)',
];
export const stepColor = (i: number) => STEP_COLORS[i % STEP_COLORS.length];

/** Mensagem de erro de API/GPS legível. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Ocorreu um erro inesperado.');
