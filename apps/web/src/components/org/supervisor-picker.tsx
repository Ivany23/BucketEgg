'use client';

import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Avatar, cn } from '@/components/ui';
import { ROLE_LABEL, type Member } from '@/lib/types';
import { displayName } from './roles';

/**
 * Escolha múltipla de supervisores (membros ativos com papel de supervisão).
 * Cada opção é uma caixa de verificação acessível com aspeto de "chip".
 */
export function SupervisorPicker({
  options,
  value,
  onChange,
  colors,
  disabled,
  legend = 'Supervisores',
  hint,
}: {
  options: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Cor de cada supervisor (a mesma do organigrama). */
  colors: Map<string, string>;
  disabled?: boolean;
  legend?: string;
  hint?: string;
}) {
  const reduce = useReducedMotion();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">
        {legend} <span className="font-normal text-ink-3">({value.length} escolhido{value.length === 1 ? '' : 's'})</span>
      </legend>
      {options.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-3 py-3 text-sm text-ink-3">
          Ainda não há supervisores ativos na organização.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((m) => {
            const checked = value.includes(m.id);
            const color = colors.get(m.id) ?? 'var(--m-config)';
            return (
              <label
                key={m.id}
                className={cn(
                  'relative inline-flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)]',
                  checked ? 'border-transparent font-semibold text-ink' : 'border-line text-ink-2 hover:border-line-strong',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
                style={checked ? { background: `color-mix(in oklab, ${color} 16%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(m.id)} />
                <span className="relative">
                  <Avatar name={m.user.name} email={m.user.email} size={26} />
                  {checked ? (
                    <motion.span
                      initial={reduce ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                      className="absolute -right-1 -bottom-1 inline-flex size-4 items-center justify-center rounded-full text-white ring-2 ring-[var(--surface)]"
                      style={{ background: color }}
                    >
                      <Check className="size-2.5" strokeWidth={4} aria-hidden />
                    </motion.span>
                  ) : null}
                </span>
                <span className="max-w-40 truncate">{displayName(m.user)}</span>
                <span className="sr-only">({ROLE_LABEL[m.role]})</span>
              </label>
            );
          })}
        </div>
      )}
      {hint ? <p className="mt-1.5 text-xs text-ink-3">{hint}</p> : null}
    </fieldset>
  );
}
