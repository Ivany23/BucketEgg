'use client';

import { ArrowRight, FilePlus2, PencilLine, RotateCcw, Trash2, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Avatar, Drawer, ErrorState, ListSkeleton } from '@/components/ui';
import { ago, dateTime } from '@/lib/format';
import { useApi } from '@/lib/query';
import type { DatasetSchema, RecordHistory } from '@/lib/types';
import { FieldTypeDot, valueText } from './field-types';

type Action = RecordHistory['revisions'][number]['action'] | 'CREATE';

const ACTION_META: Record<Action, { label: string; icon: LucideIcon; color: string; text: string }> = {
  CREATE: { label: 'Submetido', icon: FilePlus2, color: 'var(--m-dados)', text: 'var(--m-dados-text)' },
  UPDATE: { label: 'Corrigido', icon: PencilLine, color: 'var(--m-rotas)', text: 'var(--m-rotas-text)' },
  DELETE: { label: 'Removido', icon: Trash2, color: 'var(--bad)', text: 'var(--bad)' },
  RESTORE: { label: 'Restaurado', icon: RotateCcw, color: 'var(--ok)', text: 'var(--ok)' },
};

function diff(prev: Record<string, unknown> | undefined, next: Record<string, unknown> | undefined) {
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})]);
  return [...keys].filter((k) => JSON.stringify(prev?.[k] ?? null) !== JSON.stringify(next?.[k] ?? null));
}

export function RecordHistoryDrawer({
  datasetId,
  recordId,
  seq,
  schema,
  onClose,
}: {
  datasetId: string;
  recordId: string | null;
  seq?: string;
  schema: DatasetSchema;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const q = useApi<RecordHistory>(['record-history', recordId], recordId ? `/datasets/${datasetId}/records/${recordId}/history` : null);
  const h = q.data;

  const entries: {
    id: string;
    action: Action;
    who: RecordHistory['submittedBy'];
    when: string;
    reason: string | null;
    changes: string[];
    prev?: Record<string, unknown>;
    next?: Record<string, unknown>;
    outletChanged: boolean;
  }[] = h
    ? [
        ...[...h.revisions].reverse().map((r) => ({
          id: r.id,
          action: r.action as Action,
          who: r.editedBy,
          when: r.createdAt,
          reason: r.reason,
          changes: r.action === 'UPDATE' ? diff(r.previousData?.data, r.newData?.data) : [],
          prev: r.previousData?.data,
          next: r.newData?.data,
          outletChanged: r.action === 'UPDATE' && (r.previousData?.outletId ?? null) !== (r.newData?.outletId ?? null),
        })),
        { id: 'create', action: 'CREATE' as const, who: h.submittedBy, when: h.createdAt, reason: null, changes: [], outletChanged: false },
      ]
    : [];

  return (
    <Drawer
      open={!!recordId}
      onClose={onClose}
      module="dados"
      width="lg"
      title={`Histórico do registo${seq ? ` #${seq}` : ''}`}
      subtitle="Todas as correções, remoções e restauros, do mais recente para o mais antigo."
    >
      {q.isPending ? (
        <ListSkeleton rows={4} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <ol className="relative">
          {entries.map((e, i) => {
            const meta = ACTION_META[e.action];
            const Icon = meta.icon;
            const last = i === entries.length - 1;
            return (
              <motion.li
                key={e.id}
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.05, type: 'spring', stiffness: 320, damping: 28 }}
                className="relative flex gap-3 pb-6"
              >
                {!last ? (
                  <span
                    aria-hidden
                    className="absolute top-10 bottom-0 left-[19px] w-0.5 rounded-full"
                    style={{ background: `linear-gradient(${meta.color}, color-mix(in oklab, ${ACTION_META[entries[i + 1].action].color} 60%, transparent))` }}
                  />
                ) : null}
                <span
                  className="relative z-[1] inline-flex size-10 shrink-0 items-center justify-center rounded-2xl ring-4 ring-surface"
                  style={{ background: `color-mix(in oklab, ${meta.color} 18%, var(--surface))`, color: meta.text }}
                >
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `color-mix(in oklab, ${meta.color} 15%, transparent)`, color: meta.text }}>
                      {meta.label}
                    </span>
                    <time dateTime={e.when} className="text-xs text-ink-3" title={dateTime(e.when)}>
                      {dateTime(e.when)} · {ago(e.when)}
                    </time>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Avatar name={e.who?.name} email={e.who?.email} size={26} />
                    <span className="truncate text-sm font-semibold text-ink">{e.who?.name ?? e.who?.email ?? 'Desconhecido'}</span>
                  </div>
                  {e.reason ? <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2 italic">“{e.reason}”</p> : null}
                  {e.changes.length || e.outletChanged ? (
                    <ul className="mt-3 flex flex-col gap-2" aria-label="Campos alterados">
                      {e.changes.map((k) => {
                        const def = schema[k];
                        const type = def?.type ?? 'string';
                        return (
                          <li key={k} className="rounded-xl border border-line bg-surface-2/50 px-3 py-2">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                              <FieldTypeDot type={type} size="sm" />
                              {def?.label ?? k}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                              <span className="sr-only">De</span>
                              <span className="rounded-lg bg-bad-soft px-2 py-0.5 text-bad line-through decoration-bad/60">{valueText(e.prev?.[k], type)}</span>
                              <ArrowRight className="size-4 text-ink-3" aria-hidden />
                              <span className="sr-only">para</span>
                              <span className="rounded-lg bg-ok-soft px-2 py-0.5 font-semibold text-ok">{valueText(e.next?.[k], type)}</span>
                            </p>
                          </li>
                        );
                      })}
                      {e.outletChanged ? <li className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink-2">Loja associada alterada</li> : null}
                    </ul>
                  ) : e.action === 'UPDATE' ? (
                    <p className="mt-2 text-xs text-ink-3">Sem diferenças nos valores.</p>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </Drawer>
  );
}
