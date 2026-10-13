'use client';

import { Clock, MapPin, Store } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { OutletStatusBadge } from '@/components/domain';
import { cn } from '@/components/ui';
import { ago } from '@/lib/format';
import type { Outlet } from '@/lib/types';
import { ClassBadge, CreditBar, classStyle } from './meta';

/** Cartão de loja (clicável, abre o detalhe). `aside` = informação extra à direita (distância, atraso…). */
export function OutletCard({
  outlet,
  index = 0,
  onOpen,
  aside,
  footer,
  hideCredit,
}: {
  outlet: Outlet;
  index?: number;
  onOpen: (id: string) => void;
  aside?: ReactNode;
  footer?: ReactNode;
  hideCredit?: boolean;
}) {
  const reduce = useReducedMotion();
  const cls = classStyle(outlet.outletClass);
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.035, type: 'spring', stiffness: 300, damping: 28 }}
      className="list-none"
    >
      <motion.div
        whileHover={reduce ? undefined : { y: -3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="shadow-soft relative h-full overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-lift"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cls.hex }} />
        <button
          type="button"
          onClick={() => onOpen(outlet.id)}
          className="flex w-full flex-col gap-3 rounded-2xl p-4 pl-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label={`Abrir ${outlet.name}`}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              <Store className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-ink">{outlet.name}</p>
              <p className="truncate text-xs text-ink-3">
                {[outlet.code, outlet.channel].filter(Boolean).join(' · ') || 'Sem código'}
              </p>
            </div>
            {aside}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <OutletStatusBadge status={outlet.status} />
            <ClassBadge value={outlet.outletClass} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 text-ink-3" aria-hidden />
              {outlet.zone ?? 'Sem zona'}
            </span>
            <span className={cn('inline-flex items-center gap-1', !outlet.lastVisitedAt && 'text-ink-3')}>
              <Clock className="size-3.5 text-ink-3" aria-hidden />
              {outlet.lastVisitedAt ? `Visitada ${ago(outlet.lastVisitedAt)}` : 'Nunca visitada'}
            </span>
          </div>
          {hideCredit ? null : <CreditBar outlet={outlet} compact />}
        </button>
        {footer ? <div className="border-t border-line px-4 py-3 pl-5">{footer}</div> : null}
      </motion.div>
    </motion.li>
  );
}

export function OutletGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>{children}</ul>;
}
