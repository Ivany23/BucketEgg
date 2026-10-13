'use client';

import { Banknote, Info } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { money } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import { PAYMENT_METHOD_LABEL, type Outlet, type Payment, type PaymentMethod } from '@/lib/types';

type PaymentBody = components['schemas']['CreatePaymentDto'];

export function PaymentModal({ outlet, open, onClose }: { outlet: Outlet | null; open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open && !!outlet}
      onClose={onClose}
      title="Registar cobrança"
      description={outlet ? `${outlet.name} · saldo atual ${money(outlet.balance)}` : undefined}
      size="sm"
      module="lojas"
    >
      {outlet ? <PaymentForm outlet={outlet} onClose={onClose} /> : null}
    </Modal>
  );
}

function PaymentForm({ outlet, onClose }: { outlet: Outlet; onClose: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(outlet.balance > 0 ? String(outlet.balance) : '');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pay = useApiMutation(
    (body: PaymentBody) => api<Payment & { outletBalance: number }>(`/outlets/${outlet.id}/payments`, { method: 'POST', body }),
    {
      invalidate: [['outlet'], ['outlets'], ['dashboard'], ['payments']],
      onSuccess: (p) => {
        toast.success(`Cobrança de ${money(p.amount)} registada`, `Novo saldo: ${money(p.outletBalance)}`);
        onClose();
      },
      onError: (e) => toast.error('Não foi possível registar a cobrança', e.message),
    },
  );

  const value = Number(amount.replace(',', '.'));
  const overpay = Number.isFinite(value) && value > Math.max(0, outlet.balance);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      setError('Indique um valor maior que 0.');
      return;
    }
    if (!/^\d+([.,]\d{1,2})?$/.test(amount.trim())) {
      setError('No máximo 2 casas decimais.');
      return;
    }
    pay.mutate({
      amount: Math.round(value * 100) / 100,
      method,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Valor (MZN)" required error={error}>
        {(a) => (
          <Input
            {...a}
            type="number"
            min={0.01}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            className="text-lg font-bold tabular-nums"
          />
        )}
      </Field>
      {overpay && !error ? (
        <p className="flex items-start gap-2 rounded-xl bg-info-soft px-3 py-2 text-xs text-info">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          O valor é superior ao saldo em dívida: a loja ficará com crédito a seu favor.
        </p>
      ) : null}
      <Field label="Método">
        {(a) => (
          <Select {...a} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Referência" hint={method === 'MOBILE_MONEY' ? 'Código da transação M-Pesa / e-Mola.' : 'N.º do recibo, cheque ou transferência.'}>
        {(a) => <Input {...a} value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="Ex.: MPESA-ABC123" />}
      </Field>
      <Field label="Notas">
        {(a) => <Textarea {...a} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />}
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" icon={Banknote} loading={pay.isPending}>
          Registar
        </Button>
      </div>
    </form>
  );
}
