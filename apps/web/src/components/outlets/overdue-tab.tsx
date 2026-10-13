'use client';

import { AlarmClock, Flame } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { OutletStatusBadge } from '@/components/domain';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { int } from '@/lib/format';
import { useApi } from '@/lib/query';
import type { OverdueOutlet } from '@/lib/types';
import { ClassBadge, urgencyFor } from './meta';

const SCALE = [
  { label: 'Hoje', color: 'var(--info)' },
  { label: 'Ligeiro', color: 'var(--m-lojas-text)' },
  { label: 'Moderado', color: 'var(--warn)' },
  { label: 'Alto', color: 'var(--m-painel-text)' },
  { label: 'Crítico', color: 'var(--bad)' },
];

export function OverdueTab({ projectId, onOpen }: { projectId: string; onOpen: (id: string) => void }) {
  const reduce = useReducedMotion();
  const q = useApi<OverdueOutlet[]>(['outlets', projectId, 'overdue'], `/projects/${projectId}/outlets/overdue`, { limit: 50 });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending) return <ListSkeleton rows={6} />;
  if (!q.data.length)
    return (
      <EmptyState
        illustration="success"
        title="Todas as visitas em dia"
        description="Nenhuma loja ativa ultrapassou a frequência de visita definida."
      />
    );

  const maxPriority = Math.max(...q.data.map((o) => o.priority), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-ink-2">
          <Flame className="size-4 text-[var(--m-painel)]" aria-hidden />
          {int(q.data.length)} lojas por visitar, da mais urgente para a menos (atraso × potencial).
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Escala de urgência">
          {SCALE.map((s) => (
            <li key={s.label} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <ol className="flex flex-col gap-2">
        {q.data.map((o, i) => {
          const u = urgencyFor(o.overdueDays, o.visitFrequencyDays);
          return (
            <motion.li
              key={o.id}
              initial={reduce ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 14) * 0.03, type: 'spring', stiffness: 320, damping: 28 }}
            >
              <button
                type="button"
                onClick={() => onOpen(o.id)}
                className="shadow-soft group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition-[box-shadow,transform] outline-none hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:gap-4 sm:p-4"
              >
                <span className="w-6 shrink-0 text-center text-sm font-extrabold text-ink-3 tabular-nums">{i + 1}</span>
                <span
                  className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl leading-none"
                  style={{ background: u.soft, color: u.color }}
                >
                  <span className="text-lg font-extrabold tabular-nums">{o.overdueDays}</span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase">{o.overdueDays === 1 ? 'dia' : 'dias'}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink">{o.name}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {[o.zone, o.channel, `a cada ${o.visitFrequencyDays} dias`].filter(Boolean).join(' · ')}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: u.soft, color: u.color }}
                    >
                      <AlarmClock className="size-3" aria-hidden />
                      {u.label}
                    </span>
                    <ClassBadge value={o.outletClass} />
                    <span className="text-[11px] font-semibold text-ink-2 sm:hidden">
                      {o.daysSinceLastVisit === null ? 'Nunca visitada' : `Visitada há ${o.daysSinceLastVisit} dias`}
                    </span>
                    <span className="hidden sm:inline-flex">
                      <OutletStatusBadge status={o.status} />
                    </span>
                  </span>
                </span>
                <span className="hidden w-36 shrink-0 flex-col items-end gap-1.5 text-right sm:flex">
                  <span className="text-xs font-semibold text-ink-2">
                    {o.daysSinceLastVisit === null ? 'Nunca visitada' : `Última visita há ${o.daysSinceLastVisit} dias`}
                  </span>
                  <span className="flex w-full items-center gap-2">
                    <span className="sr-only">Prioridade</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full" style={{ width: `${(o.priority / maxPriority) * 100}%`, background: u.color }} />
                    </span>
                    <span className="text-[11px] font-bold text-ink-3 tabular-nums">{o.priority.toLocaleString('pt-PT')}</span>
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
