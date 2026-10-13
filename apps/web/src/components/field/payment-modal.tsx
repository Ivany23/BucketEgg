'use client';

import { Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { dateShort, money } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import { PAYMENT_METHOD_LABEL, type Payment, type PaymentMethod, type Statement } from '@/lib/types';
import { MiniStat } from './order-modal';

interface PaymentBody {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

const METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[];

export function PaymentModal({ open, onClose, outletId, outletName }: { open: boolean; onClose: () => void; outletId: string; outletName: string }) {
  const toast = useToast();
  const statement = useApi<Statement>(['statement', outletId], open ? `/outlets/${outletId}/statement` : null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pay = useApiMutation(
    (body: PaymentBody) => api<Payment & { outletBalance: number }>(`/outlets/${outletId}/payments`, { method: 'POST', body }),
    {
      invalidate: [['statement'], ['outlets'], ['dashboard'], ['orders']],
      onSuccess: (p) => {
        toast.success(`Cobrança de ${money(p.amount)} registada`, `${outletName} · novo saldo ${money(p.outletBalance)}`);
        onClose();
      },
      onError: (e) => toast.error('Não foi possível registar a cobrança', e.message),
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Indique um valor maior que zero.');
      return;
    }
    if (Math.round(value * 100) !== value * 100) {
      setError('Use no máximo 2 casas decimais.');
      return;
    }
    setError(null);
    pay.mutate({ amount: value, method, reference: reference.trim() || undefined, notes: notes.trim() || undefined });
  };

  const s = statement.data;
  const needsRef = method !== 'CASH';

  return (
    <Modal
      open={open}
      onClose={onClose}
      module="vendas"
      title="Registar cobrança"
      description={outletName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="payment-form" icon={Wallet} loading={pay.isPending}>
            Registar cobrança
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {statement.isPending ? (
          <Skeleton className="h-16" />
        ) : s ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Saldo em dívida" value={money(s.balance)} color="var(--m-vendas)" />
            <MiniStat label="Limite de crédito" value={s.outlet.creditLimit > 0 ? money(s.outlet.creditLimit) : 'Sem limite'} color="var(--m-rotas)" />
            <MiniStat label="Total pago" value={money(s.totalPaid)} color="var(--ok)" />
          </div>
        ) : (
          <p className="text-sm text-ink-3">Não foi possível carregar o extrato da loja.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor (MZN)" required error={error}>
            {(a) => (
              <Input
                {...a}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              />
            )}
          </Field>
          <Field label="Método">
            {(a) => (
              <Select {...a} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {s && s.balance > 0 ? (
          <button type="button" onClick={() => setAmount(String(s.balance))} className="self-start text-xs font-semibold text-[var(--accent-text)] underline-offset-2 hover:underline">
            Usar o saldo total em dívida ({money(s.balance)})
          </button>
        ) : null}
        <Field label="Referência" hint={needsRef ? 'Ex.: código da transação M-Pesa, nº do cheque ou do talão.' : 'Opcional (ex.: nº do recibo).'}>
          {(a) => <Input {...a} maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} />}
        </Field>
        <Field label="Notas">
          {(a) => <Textarea {...a} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />}
        </Field>
        {s && s.payments.length ? (
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-wide text-ink-3 uppercase">Últimas cobranças</p>
            <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
              {s.payments.slice(0, 3).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="text-ink-2">
                    {dateShort(p.createdAt)} · {PAYMENT_METHOD_LABEL[p.method]}
                  </span>
                  <span className="font-semibold text-ink tabular-nums">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
