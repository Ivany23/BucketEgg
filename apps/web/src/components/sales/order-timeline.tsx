'use client';

import { Ban, Check, Clock, PackageCheck, Truck, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/components/ui';
import { dateTime } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';

/** Transições que a API aceita (PATCH /orders/:id/status). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

interface Step {
  id: OrderStatus;
  label: string;
  icon: LucideIcon;
  color: string;
}

const STEPS: Step[] = [
  { id: 'SUBMITTED', label: 'Submetida', icon: Clock, color: 'var(--m-rotas)' },
  { id: 'CONFIRMED', label: 'Confirmada', icon: PackageCheck, color: 'var(--m-beats)' },
  { id: 'DELIVERED', label: 'Entregue', icon: Truck, color: 'var(--m-visitas)' },
];
const RANK: Record<OrderStatus, number> = { DRAFT: -1, SUBMITTED: 0, CONFIRMED: 1, DELIVERED: 2, CANCELLED: -1 };

/**
 * Passos visuais Submetida → Confirmada → Entregue (ou Cancelada).
 * A API não guarda o histórico de estados: mostramos a data de criação no primeiro passo e a
 * última alteração no passo atual.
 */
export function OrderTimeline({ status, createdAt, updatedAt }: { status: OrderStatus; createdAt: string; updatedAt: string }) {
  const reduce = useReducedMotion();
  const cancelled = status === 'CANCELLED';
  const current = RANK[status];
  const steps: (Step & { state: 'done' | 'current' | 'todo' | 'cancelled' })[] = cancelled
    ? [
        { ...STEPS[0], state: 'done' },
        { id: 'CANCELLED', label: 'Cancelada', icon: Ban, color: 'var(--bad)', state: 'cancelled' },
      ]
    : STEPS.map((s, i) => ({ ...s, state: i < current ? 'done' : i === current ? 'current' : 'todo' }));

  return (
    <ol className="flex items-start" aria-label="Estado da encomenda">
      {steps.map((s, i) => {
        const reached = s.state !== 'todo';
        const last = i === steps.length - 1;
        const when = i === 0 ? createdAt : s.state === 'current' || s.state === 'cancelled' ? updatedAt : null;
        const stateText = { done: 'concluído', current: 'estado atual', todo: 'por fazer', cancelled: 'estado atual' }[s.state];
        return (
          <li key={s.id} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {!last ? (
              <span aria-hidden className="absolute top-5 left-[calc(50%+22px)] right-[calc(-50%+22px)] h-1 overflow-hidden rounded-full bg-surface-3">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${s.color}, ${steps[i + 1].color})` }}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: RANK[steps[i + 1].id] <= current || steps[i + 1].state === 'cancelled' ? '100%' : '0%' }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            ) : null}
            <motion.span
              initial={reduce ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.12, type: 'spring', stiffness: 380, damping: 22 }}
              className={cn(
                'relative z-10 inline-flex size-10 items-center justify-center rounded-full border-2',
                reached ? 'text-white' : 'border-line-strong bg-surface text-ink-3',
              )}
              style={reached ? { background: s.color, borderColor: s.color, boxShadow: `0 6px 16px -6px ${s.color}` } : undefined}
            >
              {s.state === 'done' ? <Check className="size-5" strokeWidth={3} aria-hidden /> : <s.icon className="size-5" aria-hidden />}
              {s.state === 'current' ? (
                <span aria-hidden className="absolute inset-0 animate-ping rounded-full opacity-25 motion-reduce:hidden" style={{ background: s.color }} />
              ) : null}
            </motion.span>
            <span className={cn('mt-2 text-xs font-bold', reached ? 'text-ink' : 'text-ink-3')}>
              {s.label}
              <span className="sr-only"> ({stateText})</span>
            </span>
            {when ? <span className="mt-0.5 text-[11px] text-ink-3">{dateTime(when)}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
