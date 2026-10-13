'use client';

import { useReduceMotion } from '@/lib/reduce-motion';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Link from 'next/link';
import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* ───────────────────────────── Botões ───────────────────────────── */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'soft';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  // Laranja vivo com texto escuro: ≈7:1 de contraste (WCAG AA)
  primary:
    'bg-gradient-to-b from-[#fb923c] to-[#f97316] text-brand-ink shadow-[0_6px_20px_-8px_rgba(249,115,22,0.7)] hover:from-[#fdba74] hover:to-[#fb923c]',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-bad text-white hover:brightness-110 dark:text-[#1a0505]',
  accent: 'bg-[var(--accent)] text-[#10141c] hover:brightness-105',
  soft: 'bg-[var(--accent-soft)] text-[var(--accent-text)] hover:brightness-[0.97] dark:hover:brightness-125',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon: Icon, iconRight: IconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-semibold whitespace-nowrap transition-[background,color,box-shadow,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4" aria-hidden /> : null}
    </motion.button>
  );
});

/** Link com aspeto de botão (navegação; nunca um <button> dentro de um <a>). */
export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background,color,box-shadow,filter,transform] duration-150 active:scale-[0.97]',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
      {IconRight ? <IconRight className="size-4" aria-hidden /> : null}
    </Link>
  );
}

export function IconButton({
  label,
  icon: Icon,
  className,
  tone = 'ghost',
  ...rest
}: { label: string; icon: LucideIcon; tone?: 'ghost' | 'soft' | 'danger' } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-xl transition-colors',
        tone === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        tone === 'soft' && 'bg-[var(--accent-soft)] text-[var(--accent-text)] hover:brightness-95',
        tone === 'danger' && 'text-bad hover:bg-bad-soft',
        className,
      )}
      {...rest}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}

/* ───────────────────────────── Formulários ───────────────────────────── */

const control =
  'w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-ink placeholder:text-ink-3 transition-[border,box-shadow] outline-none focus:border-brand focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_18%,transparent)] disabled:opacity-60 aria-[invalid=true]:border-bad';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  /** Recebe o id e os atributos de acessibilidade a aplicar no controlo. */
  children: (a11y: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string; required?: boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
        {label}
        {required ? (
          <span className="text-bad" aria-hidden>
            {' *'}
          </span>
        ) : null}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': hint || error ? hintId : undefined, required })}
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

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, 'h-10', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(control, 'min-h-24 py-2.5', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn(control, 'h-10 cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm text-ink disabled:opacity-60"
    >
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-surface-3',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
          className={cn('size-5 rounded-full bg-white shadow', checked ? 'ml-[22px]' : 'ml-0.5')}
        />
      </span>
      {label}
    </button>
  );
}

/* ───────────────────────────── Etiquetas e cartões ───────────────────────────── */

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  brand: 'bg-brand-soft text-brand-text',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-text)]',
};

export function Badge({ tone = 'neutral', icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', tones[tone], className)}>
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  interactive,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  if (interactive) {
    return (
      <motion.div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        whileHover={reduce ? undefined : { y: -3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className={cn('shadow-soft min-w-0 cursor-pointer rounded-2xl border border-line bg-surface transition-shadow hover:shadow-lift', className)}
      >
        {children}
      </motion.div>
    );
  }
  return <div className={cn('shadow-soft min-w-0 rounded-2xl border border-line bg-surface', className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} aria-hidden />;
}

export function Spinner({ label = 'A carregar…' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-ink-3">
      <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
      {label}
    </span>
  );
}

export function ProgressBar({ value, max = 100, tone = 'brand', label }: { value: number; max?: number; tone?: 'brand' | 'ok' | 'accent' | 'warn'; label?: string }) {
  const pctValue = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const color = { brand: 'var(--brand)', ok: 'var(--ok)', accent: 'var(--accent)', warn: 'var(--warn)' }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pctValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pctValue}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/** Número que "conta" até ao valor (desativado com reduzir movimento). */
export function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString('pt-PT') }: { value: number; format?: (v: number) => string }) {
  // Versão segura para a hidratação (o useReducedMotion do motion difere entre servidor e cliente)
  const reduce = useReduceMotion();
  const spring = useSpring(reduce ? value : 0, { stiffness: 90, damping: 22 });
  const text = useTransform(spring, (v) => format(v));
  const [shown, setShown] = useState(() => format(reduce ? value : 0));
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);
  useEffect(() => text.on('change', (v) => setShown(v)), [text]);
  return <span className="tabular-nums">{reduce ? format(value) : shown}</span>;
}

export function Avatar({ name, email, size = 36 }: { name?: string | null; email?: string | null; size?: number }) {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  const text = ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
  // Cor estável por pessoa (mesma pessoa = mesma cor em toda a aplicação)
  const palette = ['#f97316', '#3b82f6', '#14b8a6', '#8b5cf6', '#ec4899', '#22c55e', '#f59e0b', '#6366f1'];
  let h = 0;
  for (const c of src) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-[#1a1208]"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `color-mix(in oklab, ${palette[h % palette.length]} 75%, white)` }}
    >
      {text}
    </span>
  );
}
