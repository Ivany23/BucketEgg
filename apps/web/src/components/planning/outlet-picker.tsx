'use client';

import { ArrowDown, ArrowUp, Check, Clock, MapPinOff, Plus, Store, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Badge, Button, ErrorState, IconButton, SearchInput, Skeleton, cn } from '@/components/ui';
import { useApi } from '@/lib/query';
import type { OverdueOutlet, Outlet, Page } from '@/lib/types';
import { STEP_COLORS } from './shared';

const hasGps = (o: Outlet) => o.latitude != null && o.longitude != null;

function OutletLine({ o }: { o: Outlet }) {
  return (
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-sm font-semibold text-ink">{o.name}</span>
      <span className="block truncate text-xs text-ink-3">
        {[o.code, o.address ?? o.zone, o.channel].filter(Boolean).join(' · ') || 'Sem morada'}
      </span>
    </span>
  );
}

/** Resultados da pesquisa de lojas ativas (linhas selecionáveis). */
function SearchResults({
  projectId,
  search,
  isSelected,
  onToggle,
  disabledAdd,
}: {
  projectId: string;
  search: string;
  isSelected: (id: string) => boolean;
  onToggle: (o: Outlet) => void;
  disabledAdd: boolean;
}) {
  const q = useApi<Page<Outlet>>(['outlets', projectId, 'picker', search], `/projects/${projectId}/outlets`, {
    status: 'ACTIVE',
    search,
    limit: 50,
  });
  if (q.isPending) {
    return (
      <div className="flex flex-col gap-2 p-2" aria-busy="true" aria-label="A carregar lojas">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const rows = q.data.data;
  if (!rows.length) {
    return <p className="px-3 py-6 text-center text-sm text-ink-3">{search ? `Nenhuma loja ativa encontrada para “${search}”.` : 'Ainda não há lojas ativas neste projeto.'}</p>;
  }
  return (
    <>
      <ul className="flex flex-col gap-1 p-1.5" aria-label="Lojas encontradas">
        {rows.map((o) => {
          const on = isSelected(o.id);
          return (
            <li key={o.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={!on && disabledAdd}
                onClick={() => onToggle(o)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  on ? 'bg-[var(--accent-soft)]' : 'hover:bg-surface-2',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'inline-flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                    on ? 'border-transparent bg-[var(--accent)] text-[#10141c]' : 'border-line-strong',
                  )}
                >
                  {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <OutletLine o={o} />
                {!hasGps(o) ? (
                  <Badge tone="warn" icon={MapPinOff}>
                    Sem GPS
                  </Badge>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {q.data.meta.total > rows.length ? (
        <p className="px-3 pb-2 text-xs text-ink-3">
          A mostrar {rows.length} de {q.data.meta.total.toLocaleString('pt-PT')} — refine a pesquisa para encontrar outras.
        </p>
      ) : null}
    </>
  );
}

/** Sugestões: lojas em atraso de visita (prioridade da API). */
function OverdueSuggestions({
  projectId,
  isSelected,
  onAdd,
  room,
}: {
  projectId: string;
  isSelected: (id: string) => boolean;
  onAdd: (list: Outlet[]) => void;
  room: number;
}) {
  const q = useApi<OverdueOutlet[]>(['outlets-overdue', projectId, 10], `/projects/${projectId}/outlets/overdue`, { limit: 10 });
  const reduce = useReducedMotion();
  if (q.isPending) return <Skeleton className="h-20" />;
  if (q.isError) return <p className="text-xs text-bad">Não foi possível carregar as sugestões: {q.error.message}</p>;
  const open = q.data.filter((o) => !isSelected(o.id));
  if (!q.data.length) return <p className="text-xs text-ink-3">Nenhuma loja em atraso. Boa cobertura!</p>;
  return (
    <div className="rounded-2xl border border-dashed border-[color-mix(in_oklab,var(--m-dia)_45%,transparent)] bg-[color-mix(in_oklab,var(--m-dia)_7%,transparent)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--m-dia-text)]">
          <Clock className="size-4" aria-hidden />
          Sugestões: lojas em atraso
        </p>
        {open.length > 1 ? (
          <Button size="sm" variant="ghost" icon={Plus} disabled={room <= 0} onClick={() => onAdd(open.slice(0, room))}>
            Adicionar todas
          </Button>
        ) : null}
      </div>
      {open.length ? (
        <ul className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {open.map((o) => (
              <motion.li
                key={o.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              >
                <button
                  type="button"
                  disabled={room <= 0}
                  onClick={() => onAdd([o])}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1.5 text-xs font-semibold text-ink transition-colors hover:border-[var(--m-dia)] disabled:opacity-50"
                  title={`Adicionar ${o.name}`}
                >
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--m-dia)_22%,transparent)] text-[var(--m-dia-text)]">
                    <Plus className="size-3.5" aria-hidden />
                  </span>
                  <span className="truncate">{o.name}</span>
                  <span className="shrink-0 font-medium text-ink-3">
                    · {o.daysSinceLastVisit == null ? 'nunca visitada' : `${o.overdueDays} d em atraso`}
                  </span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="text-xs text-ink-3">Todas as sugestões já foram adicionadas.</p>
      )}
    </div>
  );
}

/**
 * Escolha de várias lojas: pesquisa com linhas selecionáveis, lojas escolhidas como
 * etiquetas removíveis (ou lista ordenável) e, opcionalmente, sugestões de lojas em atraso.
 */
export function OutletPicker({
  projectId,
  selected,
  onChange,
  max = 200,
  ordered = false,
  suggestions = false,
  label = 'Lojas',
}: {
  projectId: string;
  selected: Outlet[];
  onChange: (next: Outlet[]) => void;
  max?: number;
  /** Lista ordenável (subir/descer) em vez de etiquetas. */
  ordered?: boolean;
  suggestions?: boolean;
  label?: string;
}) {
  const [search, setSearch] = useState('');
  const reduce = useReducedMotion();
  const ids = new Set(selected.map((o) => o.id));
  const isSelected = (id: string) => ids.has(id);
  const room = max - selected.length;
  const add = (list: Outlet[]) => onChange([...selected, ...list.filter((o) => !ids.has(o.id))].slice(0, max));
  const remove = (id: string) => onChange(selected.filter((o) => o.id !== id));
  const toggle = (o: Outlet) => (ids.has(o.id) ? remove(o.id) : add([o]));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const noGps = selected.filter((o) => !hasGps(o)).length;

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar por nome, código, morada ou telefone…" label={`Pesquisar ${label.toLowerCase()}`} />
      <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface-2/40">
        <SearchResults projectId={projectId} search={search} isSelected={isSelected} onToggle={toggle} disabledAdd={room <= 0} />
      </div>

      {suggestions ? <OverdueSuggestions projectId={projectId} isSelected={isSelected} onAdd={add} room={room} /> : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-ink-2" aria-live="polite">
            {selected.length ? `${selected.length} ${selected.length === 1 ? 'loja escolhida' : 'lojas escolhidas'}` : 'Nenhuma loja escolhida'}
            <span className="text-ink-3"> · máx. {max}</span>
          </p>
          {selected.length ? (
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              Limpar
            </Button>
          ) : null}
        </div>
        {noGps ? (
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-warn">
            <MapPinOff className="size-3.5" aria-hidden />
            {noGps === 1 ? '1 loja sem GPS entra' : `${noGps} lojas sem GPS entram`} no fim da rota, pela ordem escolhida.
          </p>
        ) : null}

        {ordered ? (
          <ol className="flex flex-col gap-1.5" aria-label={`${label} por ordem de visita`}>
            <AnimatePresence initial={false}>
              {selected.map((o, i) => (
                <motion.li
                  key={o.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-2"
                >
                  <span
                    aria-hidden
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold"
                    style={{ background: `color-mix(in oklab, ${STEP_COLORS[i % STEP_COLORS.length]} 18%, transparent)`, color: STEP_COLORS[i % STEP_COLORS.length] }}
                  >
                    {i + 1}
                  </span>
                  <OutletLine o={o} />
                  <IconButton label={`Subir ${o.name}`} icon={ArrowUp} disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30" />
                  <IconButton
                    label={`Descer ${o.name}`}
                    icon={ArrowDown}
                    disabled={i === selected.length - 1}
                    onClick={() => move(i, 1)}
                    className="disabled:opacity-30"
                  />
                  <IconButton label={`Remover ${o.name}`} icon={X} tone="danger" onClick={() => remove(o.id)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label={`${label} escolhidas`}>
            <AnimatePresence initial={false}>
              {selected.map((o, i) => (
                <motion.li
                  key={o.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="inline-flex max-w-full items-center gap-1 rounded-full py-1 pr-1 pl-2.5 text-xs font-semibold text-ink"
                  style={{ background: `color-mix(in oklab, ${STEP_COLORS[i % STEP_COLORS.length]} 14%, transparent)` }}
                >
                  <Store className="size-3.5 shrink-0" style={{ color: STEP_COLORS[i % STEP_COLORS.length] }} aria-hidden />
                  <span className="truncate">{o.name}</span>
                  <button
                    type="button"
                    onClick={() => remove(o.id)}
                    aria-label={`Remover ${o.name}`}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-bad"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

/** Escolha de uma única loja ativa (pesquisa + linhas). */
export function OutletSingleSelect({
  projectId,
  value,
  onChange,
  error,
}: {
  projectId: string;
  value: Outlet | null;
  onChange: (o: Outlet | null) => void;
  error?: string | null;
}) {
  const [search, setSearch] = useState('');
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2">
        <Store className="size-4 shrink-0 text-[var(--accent-text)]" aria-hidden />
        <OutletLine o={value} />
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Trocar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar loja…" label="Pesquisar loja" />
      <div className={cn('scrollbar-thin max-h-56 overflow-y-auto rounded-2xl border bg-surface-2/40', error ? 'border-bad' : 'border-line')}>
        <SearchResults projectId={projectId} search={search} isSelected={() => false} onToggle={(o) => onChange(o)} disabledAdd={false} />
      </div>
      {error ? (
        <p className="text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
