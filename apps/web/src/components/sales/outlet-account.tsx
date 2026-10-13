'use client';

import { CreditCard, Scale, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimatedNumber, ProgressBar, Skeleton, cn } from '@/components/ui';
import { money } from '@/lib/format';
import { useApi } from '@/lib/query';
import type { Statement } from '@/lib/types';

/** Extrato da loja (saldo em dívida, limite e crédito disponível). */
export function useStatement(outletId: string | null | undefined) {
  return useApi<Statement>(['statement', outletId], outletId ? `/outlets/${outletId}/statement` : null);
}

/** Crédito disponível (null = sem limite, porque limite 0 significa "sem limite" na API). */
export function availableCredit(s: Pick<Statement, 'balance'> & { outlet: { creditLimit: number } }): number | null {
  return s.outlet.creditLimit > 0 ? s.outlet.creditLimit - s.balance : null;
}

/** Cartão colorido com a conta corrente da loja. `extra` = valor a acrescentar (ex.: encomenda em curso). */
export function OutletAccount({ outletId, extra = 0, className }: { outletId: string; extra?: number; className?: string }) {
  const q = useStatement(outletId);
  if (q.isPending) return <Skeleton className={cn('h-28', className)} />;
  if (q.isError) {
    return (
      <p role="alert" className={cn('rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad', className)}>
        Não foi possível ler a conta da loja: {q.error.message}
      </p>
    );
  }
  const s = q.data;
  const limit = s.outlet.creditLimit;
  const available = availableCredit(s);
  const after = s.balance + extra;
  const over = limit > 0 && after > limit;
  const tiles = [
    { label: 'Em dívida', value: s.balance, icon: Wallet, color: 'var(--m-vendas)' },
    { label: 'Limite de crédito', value: limit, icon: CreditCard, color: 'var(--m-rotas)', none: limit <= 0 },
    {
      label: 'Disponível',
      value: available ?? 0,
      icon: Scale,
      color: available !== null && available <= 0 ? 'var(--bad)' : 'var(--m-visitas)',
      none: available === null,
    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={cn('rounded-2xl border border-line bg-surface-2/60 p-3 sm:p-4', className)}
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase sm:text-xs">
              <t.icon className="size-3.5 shrink-0" style={{ color: t.color }} aria-hidden />
              <span className="truncate">{t.label}</span>
            </p>
            <p className="mt-1 truncate text-sm font-extrabold text-ink sm:text-base">
              {t.none ? <span className="font-semibold text-ink-3">Sem limite</span> : <AnimatedNumber value={t.value} format={money} />}
            </p>
          </div>
        ))}
      </div>
      {limit > 0 ? (
        <div className="mt-3">
          <ProgressBar value={after} max={limit} tone={over ? 'warn' : 'accent'} label="Utilização do limite de crédito" />
          <p className={cn('mt-1.5 text-xs', over ? 'font-semibold text-warn' : 'text-ink-3')}>
            {extra > 0
              ? over
                ? `Com esta encomenda (${money(extra)}) a dívida passa a ${money(after)} e excede o limite em ${money(after - limit)}.`
                : `Com esta encomenda a dívida passa a ${money(after)} (${Math.round((after / limit) * 100)}% do limite).`
              : `${Math.round((s.balance / limit) * 100)}% do limite utilizado.`}
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}
