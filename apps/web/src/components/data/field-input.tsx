'use client';

import { Check, Minus, X } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import { Input, cn } from '@/components/ui';
import { FieldTypeDot, type DraftValue } from './field-types';

interface A11y {
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  required?: boolean;
}

const boolOptions: { value: boolean | null; label: string; icon: typeof Check; tone: string }[] = [
  { value: true, label: 'Sim', icon: Check, tone: 'bg-ok-soft text-ok border-ok/40' },
  { value: false, label: 'Não', icon: X, tone: 'bg-bad-soft text-bad border-bad/40' },
  { value: null, label: 'Sem resposta', icon: Minus, tone: 'bg-surface-2 text-ink-2 border-line-strong' },
];

/** Sim / Não como grupo de opções (setas mudam a escolha, como num grupo de rádio nativo). */
function YesNo({ value, onChange, labelledBy, disabled }: { value: boolean | null; onChange: (v: boolean | null) => void; labelledBy: string; disabled?: boolean }) {
  const current = Math.max(0, boolOptions.findIndex((o) => o.value === value));
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (current + delta + boolOptions.length) % boolOptions.length;
    onChange(boolOptions[next].value);
    const group = e.currentTarget.parentElement;
    group?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {boolOptions.map((o, i) => {
        const checked = i === current;
        const Icon = o.icon;
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={onKey}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60',
              checked ? o.tone : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pergunta de um formulário, com o controlo adequado ao tipo. */
export function FieldInput({
  label,
  type,
  value,
  onChange,
  error,
  hint,
  disabled,
}: {
  label: string;
  type: string;
  value: DraftValue;
  onChange: (v: DraftValue) => void;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const a11y: A11y = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? hintId : undefined };
  const text = typeof value === 'string' ? value : '';
  return (
    <div className="flex flex-col gap-1.5">
      <label id={labelId} htmlFor={type === 'boolean' ? undefined : id} className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        <FieldTypeDot type={type} size="sm" />
        {label}
      </label>
      {type === 'boolean' ? (
        <YesNo value={typeof value === 'boolean' ? value : null} onChange={onChange} labelledBy={labelId} disabled={disabled} />
      ) : type === 'number' ? (
        <Input {...a11y} type="text" inputMode="decimal" autoComplete="off" value={text} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="0" />
      ) : type === 'date' ? (
        <Input {...a11y} type="date" value={text} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      ) : type === 'photo' ? (
        <Input {...a11y} type="url" inputMode="url" value={text} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
      ) : (
        <Input {...a11y} type="text" value={text} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
      {error ? (
        <p id={hintId} className="text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
