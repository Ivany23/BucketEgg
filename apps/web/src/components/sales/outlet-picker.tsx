'use client';

import { Loader2, MapPin, Search, Store, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { money } from '@/lib/format';
import { useApi } from '@/lib/query';
import type { Outlet, OutletStatus, Page } from '@/lib/types';

/** O mínimo que o ecrã precisa de saber sobre a loja escolhida. */
export interface OutletRef {
  id: string;
  name: string;
  zone?: string | null;
  address?: string | null;
}

/**
 * Caixa de escolha de loja com pesquisa (combobox acessível: setas, Enter, Esc).
 * Pesquisa na API com espera de 300 ms; por omissão só lojas ativas.
 */
export function OutletPicker({
  projectId,
  value,
  onChange,
  label,
  status = 'ACTIVE',
  placeholder = 'Pesquisar loja por nome, código ou zona…',
  hint,
  error,
  required,
  compact,
  showBalance,
}: {
  projectId: string;
  value: OutletRef | null;
  onChange: (outlet: OutletRef | null, full?: Outlet) => void;
  label: string;
  status?: OutletStatus | null;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /** Versão de filtro (mais baixa, rótulo escondido). */
  compact?: boolean;
  /** Mostrar o saldo em dívida em cada opção. */
  showBalance?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (text === search) return;
    const t = setTimeout(() => setSearch(text), 300);
    return () => clearTimeout(t);
  }, [text, search]);

  const q = useApi<Page<Outlet>>(
    ['outlets', projectId, 'picker', status ?? 'all', search],
    `/projects/${projectId}/outlets`,
    { status: status ?? undefined, search: search.trim() || undefined, limit: 20 },
    { enabled: open && !value, staleTime: 60_000 },
  );
  const options = q.data?.data ?? [];
  const activeIndex = Math.min(active, Math.max(0, options.length - 1));

  const pick = (o: Outlet) => {
    onChange({ id: o.id, name: o.name, zone: o.zone, address: o.address }, o);
    setOpen(false);
    setText('');
    setSearch('');
  };

  const clear = () => {
    onChange(null);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', compact && 'gap-0')}>
      <label htmlFor={id} className={cn('text-[13px] font-semibold text-ink-2', compact && 'sr-only')}>
        {label}
        {required ? <span className="text-bad"> *</span> : null}
      </label>
      {value ? (
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[var(--accent-soft)] px-3',
            compact ? 'h-10' : 'min-h-12 py-2',
          )}
        >
          <Store className="size-4 shrink-0 text-[var(--accent-text)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p id={id} tabIndex={-1} className="truncate text-sm font-semibold text-ink">
              {value.name}
            </p>
            {!compact && (value.zone || value.address) ? (
              <p className="truncate text-xs text-ink-2">{[value.zone, value.address].filter(Boolean).join(' · ')}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label={`Trocar loja (${value.name})`}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-surface hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || (hint && !compact) ? hintId : undefined}
            aria-required={required || undefined}
            autoComplete="off"
            value={text}
            placeholder={placeholder}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setOpen(true);
                setActive(Math.min(activeIndex + 1, options.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(Math.max(activeIndex - 1, 0));
              } else if (e.key === 'Enter' && open && options[activeIndex]) {
                e.preventDefault();
                pick(options[activeIndex]);
              } else if (e.key === 'Escape' && open) {
                // Fecha só a lista (não o diálogo à volta).
                e.stopPropagation();
                setOpen(false);
              }
            }}
            className="h-10 w-full rounded-xl border border-line-strong bg-surface pr-9 pl-9 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_18%,transparent)] aria-[invalid=true]:border-bad"
          />
          {q.isFetching ? (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-3" aria-hidden />
          ) : null}
          <AnimatePresence>
            {open ? (
              <motion.ul
                id={listId}
                role="listbox"
                aria-label={label}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="shadow-lift scrollbar-thin absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5"
              >
                {q.isPending ? (
                  <li className="px-3 py-3 text-sm text-ink-3">A procurar lojas…</li>
                ) : q.isError ? (
                  <li className="px-3 py-3 text-sm text-bad">{q.error.message}</li>
                ) : options.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-ink-3">{search ? `Nenhuma loja encontrada para "${search}".` : 'Sem lojas disponíveis.'}</li>
                ) : (
                  options.map((o, i) => (
                    <li
                      key={o.id}
                      id={`${id}-opt-${i}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(o)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2',
                        i === activeIndex ? 'bg-[var(--accent-soft)]' : 'hover:bg-surface-2',
                      )}
                    >
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[var(--accent-text)]">
                        <Store className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{o.name}</span>
                        <span className="flex items-center gap-1 truncate text-xs text-ink-3">
                          {o.zone ? (
                            <>
                              <MapPin className="size-3" aria-hidden />
                              {o.zone}
                            </>
                          ) : (
                            (o.code ?? o.channel ?? '')
                          )}
                        </span>
                      </span>
                      {showBalance && o.balance > 0 ? (
                        <span className="shrink-0 text-right text-xs">
                          <span className="block text-ink-3">Em dívida</span>
                          <span className="font-semibold text-ink tabular-nums">{money(o.balance)}</span>
                        </span>
                      ) : null}
                    </li>
                  ))
                )}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </div>
      )}
      {error ? (
        <p id={hintId} role="alert" className="text-xs font-medium text-bad">
          {error}
        </p>
      ) : hint && !compact ? (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
