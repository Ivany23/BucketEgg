'use client';

import { CheckCircle2, ChevronRight, CircleDot, ClipboardList, FileSpreadsheet, Rows3, XCircle, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Badge, cn, type Tone } from '@/components/ui';
import { date, int } from '@/lib/format';
import type { Dataset } from '@/lib/types';
import { FieldTypeChip, isImported, schemaFields } from './field-types';

const STATUS: Record<Dataset['status'], [string, Tone, LucideIcon]> = {
  READY: ['Pronto', 'ok', CheckCircle2],
  PROCESSING: ['A importar', 'info', CircleDot],
  FAILED: ['Falhou', 'bad', XCircle],
};

export function DatasetStatusBadge({ status }: { status: Dataset['status'] }) {
  const [label, tone, icon] = STATUS[status] ?? STATUS.READY;
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

export function KindBadge({ dataset }: { dataset: Pick<Dataset, 'schema'> }) {
  const imported = isImported(dataset);
  const color = imported ? 'var(--m-import)' : 'var(--m-dados)';
  const text = imported ? 'var(--m-import-text)' : 'var(--m-dados-text)';
  const Icon = imported ? FileSpreadsheet : ClipboardList;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
      style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color: text }}
    >
      <Icon className="size-3.5" aria-hidden />
      {imported ? 'Importado' : 'Formulário'}
    </span>
  );
}

/** Contagem de campos ativos por tipo (para os chips coloridos). */
export function typeCounts(dataset: Pick<Dataset, 'schema'>) {
  const counts = new Map<string, number>();
  for (const f of schemaFields(dataset.schema, true)) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
  return [...counts.entries()];
}

export function DatasetCard({
  dataset,
  index,
  selected,
  onSelect,
  rowsLabel,
}: {
  dataset: Dataset;
  index: number;
  selected: boolean;
  onSelect: () => void;
  rowsLabel: string;
}) {
  const reduce = useReducedMotion();
  const imported = isImported(dataset);
  const active = schemaFields(dataset.schema, true).length;
  const color = imported ? 'var(--m-import)' : 'var(--m-dados)';
  const Icon = imported ? FileSpreadsheet : ClipboardList;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ delay: Math.min(index, 10) * 0.05, type: 'spring', stiffness: 280, damping: 26 }}
      className={cn(
        'shadow-soft group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-surface p-4 text-left transition-[box-shadow,border-color] hover:shadow-lift',
        selected ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30' : 'border-line',
      )}
    >
      <span
        aria-hidden
        className="absolute -top-10 -right-10 size-28 rounded-full opacity-[0.13] transition-transform duration-500 group-hover:scale-125"
        style={{ background: color }}
      />
      <div className="relative flex items-start gap-3">
        <span
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">{dataset.name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <KindBadge dataset={dataset} />
            {dataset.status !== 'READY' ? <DatasetStatusBadge status={dataset.status} /> : null}
          </div>
        </div>
        <ChevronRight className={cn('mt-1 size-5 shrink-0 text-ink-3 transition-transform', selected ? 'rotate-90 text-[var(--accent-text)]' : 'group-hover:translate-x-0.5')} aria-hidden />
      </div>

      <dl className="relative mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 px-2 py-2">
          <dt className="text-[11px] font-semibold text-ink-3">{rowsLabel}</dt>
          <dd className="flex items-center justify-center gap-1 text-base font-extrabold text-ink tabular-nums">
            <Rows3 className="size-3.5 text-ink-3" aria-hidden />
            {int(dataset.rowCount)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 px-2 py-2">
          <dt className="text-[11px] font-semibold text-ink-3">Campos</dt>
          <dd className="text-base font-extrabold text-ink tabular-nums">{active}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 px-2 py-2">
          <dt className="text-[11px] font-semibold text-ink-3">Criado</dt>
          <dd className="truncate text-[13px] leading-6 font-bold text-ink">{date(dataset.createdAt)}</dd>
        </div>
      </dl>

      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {typeCounts(dataset).map(([type, n]) => (
          <FieldTypeChip key={type} type={type} count={n} />
        ))}
      </div>
    </motion.button>
  );
}
