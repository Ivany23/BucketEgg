'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight, RefreshCw, Search, WifiOff } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { Illustration, type IllustrationName } from '../illustrations';
import { AnimatedNumber, Button, Skeleton, cn } from './core';

/* ───────────────────────────── Cabeçalho de página ───────────────────────────── */

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  eyebrow,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        <motion.span
          initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
        >
          <Icon className="size-6" aria-hidden />
          <span aria-hidden className="absolute -right-1 -bottom-1 size-3.5 rounded-full border-2 border-bg" style={{ background: 'var(--accent)' }} />
        </motion.span>
        <div className="min-w-0">
          {eyebrow ? <div className="mb-0.5 text-xs font-semibold tracking-wide text-[var(--accent-text)] uppercase">{eyebrow}</div> : null}
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ───────────────────────────── Estados ───────────────────────────── */

export function EmptyState({
  illustration = 'box',
  title,
  description,
  action,
  compact,
}: {
  illustration?: IllustrationName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center text-center', compact ? 'py-8' : 'py-14')}
    >
      <Illustration name={illustration} className={compact ? 'h-24' : 'h-36'} />
      <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </motion.div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = error instanceof ApiError && error.status === 0;
  const message = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-dashed border-bad/40 bg-bad-soft/40 px-6 py-10 text-center">
      {offline ? <WifiOff className="size-8 text-bad" aria-hidden /> : <Illustration name="oops" className="h-24" />}
      <h3 className="mt-3 text-base font-bold text-ink">{offline ? 'Sem ligação' : 'Não foi possível carregar'}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-2">{message}</p>
      {onRetry ? (
        <Button className="mt-4" icon={RefreshCw} onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}

/** Lista de esqueletos enquanto carrega (mantém o layout estável). */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-label="A carregar">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

/* ───────────────────────────── Navegação local ───────────────────────────── */

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const group = useId();
  return (
    <div role="tablist" className={cn('scrollbar-thin flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1', className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {active ? (
              <motion.span
                layoutId={`tab-${group}`}
                className="shadow-soft absolute inset-0 rounded-xl bg-surface"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-2">
              {t.icon ? <t.icon className="size-4" style={active ? { color: 'var(--accent-text)' } : undefined} aria-hidden /> : null}
              {t.label}
              {t.count !== undefined ? (
                <span
                  className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-surface-3 text-ink-3')}
                >
                  {t.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({ page, pages, onChange, total }: { page: number; pages: number; onChange: (p: number) => void; total?: number }) {
  if (pages <= 1) return total !== undefined ? <p className="mt-4 text-xs text-ink-3">{total.toLocaleString('pt-PT')} resultados</p> : null;
  return (
    <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-ink-3">
        Página {page} de {pages}
        {total !== undefined ? ` · ${total.toLocaleString('pt-PT')} resultados` : ''}
      </p>
      <div className="flex gap-1.5">
        <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <Button size="sm" variant="secondary" iconRight={ChevronRight} disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Seguinte
        </Button>
      </div>
    </nav>
  );
}

/** Pesquisa com espera de 300 ms (não faz um pedido por tecla). */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Pesquisar…',
  className,
  label = 'Pesquisar',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Valor externo mudou (ex.: limpar filtros): acompanha-o.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_18%,transparent)]"
      />
    </label>
  );
}

/* ───────────────────────────── Indicadores ───────────────────────────── */

export function StatTile({
  label,
  value,
  format,
  hint,
  icon: Icon,
  color,
  index = 0,
}: {
  label: string;
  value: number;
  format?: (v: number) => string;
  hint?: ReactNode;
  icon: LucideIcon;
  /** Cor do ícone (variável CSS de um módulo, ex.: var(--m-rotas)). */
  color: string;
  index?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
      whileHover={reduce ? undefined : { y: -3 }}
      className="shadow-soft group relative overflow-hidden rounded-2xl border border-line bg-surface p-4"
    >
      <span
        aria-hidden
        className="absolute -top-8 -right-8 size-24 rounded-full opacity-[0.14] transition-transform duration-500 group-hover:scale-125"
        style={{ background: color }}
      />
      <div className="relative flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        <span className="inline-flex size-8 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}>
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </div>
      <div className="relative mt-3 text-[clamp(1.05rem,5.2vw,1.625rem)] leading-tight font-extrabold tracking-tight break-words text-ink sm:text-[26px] sm:leading-none">
        <AnimatedNumber value={value} format={format} />
      </div>
      {hint ? <div className="relative mt-2 text-xs text-ink-3">{hint}</div> : null}
    </motion.div>
  );
}

/* ───────────────────────────── Tabela ───────────────────────────── */

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Esconder em ecrãs pequenos. */
  hideOnMobile?: boolean;
  align?: 'left' | 'right' | 'center';
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Texto acessível do botão de cada linha (quando é clicável). */
  rowLabel?: (row: T) => string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-2/60 text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'px-4 py-3 text-xs font-bold tracking-wide text-ink-3 uppercase',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                  c.hideOnMobile && 'hidden md:table-cell',
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <motion.tr
              key={rowKey(row)}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.025 }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
              className={cn(
                'border-b border-line last:border-0',
                onRowClick && 'cursor-pointer transition-colors hover:bg-[var(--accent-soft)]/50 focus-visible:bg-[var(--accent-soft)]/60',
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-3 align-middle text-ink',
                    c.align === 'right' && 'text-right tabular-nums',
                    c.align === 'center' && 'text-center',
                    c.hideOnMobile && 'hidden md:table-cell',
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Aparece em cascata (cada filho com um pequeno atraso). */
export function Stagger({ children, className }: { children: ReactNode[]; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 10) * 0.04, type: 'spring', stiffness: 260, damping: 26 }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
