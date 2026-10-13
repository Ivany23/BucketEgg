'use client';

import { Banknote, CreditCard, Landmark, ReceiptText, Smartphone, Wallet, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Textarea, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import { PAYMENT_METHOD_LABEL, type Payment, type PaymentMethod } from '@/lib/types';
import { OutletAccount, useStatement } from './outlet-account';
import { OutletPicker, type OutletRef } from './outlet-picker';

interface PaymentBody {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

const METHODS: { id: PaymentMethod; icon: LucideIcon; color: string }[] = [
  { id: 'CASH', icon: Banknote, color: 'var(--m-visitas)' },
  { id: 'MOBILE_MONEY', icon: Smartphone, color: 'var(--m-vendas)' },
  { id: 'BANK_TRANSFER', icon: Landmark, color: 'var(--m-rotas)' },
  { id: 'CARD', icon: CreditCard, color: 'var(--m-beats)' },
  { id: 'CHEQUE', icon: ReceiptText, color: 'var(--m-dia)' },
];

/** Registar cobrança (pagamento) de uma loja: abate ao saldo em dívida. */
export function PaymentModal({
  open,
  onClose,
  projectId,
  outlet,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Loja já escolhida (ex.: a partir de uma encomenda). */
  outlet?: OutletRef | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      module="vendas"
      size="md"
      title="Registar cobrança"
      description="O valor recebido abate ao saldo em dívida da loja."
    >
      {/* O formulário só existe com o diálogo aberto: abre sempre limpo. */}
      <PaymentForm projectId={projectId} initialOutlet={outlet ?? null} onDone={onClose} />
    </Modal>
  );
}

function PaymentForm({ projectId, initialOutlet, onDone }: { projectId: string; initialOutlet: OutletRef | null; onDone: () => void }) {
  const toast = useToast();
  const [outlet, setOutlet] = useState<OutletRef | null>(initialOutlet);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ outlet?: string; amount?: string }>({});
  const statement = useStatement(outlet?.id);
  const balance = statement.data?.balance ?? 0;

  const save = useApiMutation(
    (body: PaymentBody) => api<Payment & { outletBalance: number }>(`/outlets/${outlet?.id}/payments`, { method: 'POST', body }),
    {
      invalidate: [['statement'], ['outlets'], ['outlet'], ['dashboard']],
      onSuccess: (p) => {
        toast.success(`Cobrança de ${money(p.amount)} registada`, `Saldo em dívida de ${outlet?.name}: ${money(p.outletBalance)}`);
        onDone();
      },
      onError: (e) => toast.error('Não foi possível registar a cobrança', e.message),
    },
  );

  const value = Number(amount.replace(',', '.'));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!outlet) next.outlet = 'Escolha a loja.';
    if (!amount || !Number.isFinite(value) || value <= 0) next.amount = 'Indique um valor maior que zero.';
    else if (!/^\d+([.,]\d{1,2})?$/.test(amount.trim())) next.amount = 'No máximo 2 casas decimais.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({
      amount: value,
      method,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <OutletPicker
        projectId={projectId}
        label="Loja"
        required
        value={outlet}
        status={null}
        showBalance
        onChange={(o) => {
          setOutlet(o);
          setErrors((er) => ({ ...er, outlet: undefined }));
        }}
        error={errors.outlet}
      />
      {outlet ? <OutletAccount outletId={outlet.id} extra={0} /> : null}

      <Field
        label="Valor recebido (MZN)"
        required
        error={errors.amount}
        hint={
          balance > 0 ? (
            <span>
              Em dívida: {money(balance)}{' '}
              <button type="button" className="font-semibold text-[var(--accent-text)] underline-offset-2 hover:underline" onClick={() => setAmount(String(balance))}>
                Usar valor total
              </button>
            </span>
          ) : value > 0 && outlet ? (
            'A loja não tem dívida: o valor fica como crédito a favor.'
          ) : undefined
        }
      >
        {(a) => <Input {...a} inputMode="decimal" type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />}
      </Field>
      {balance > 0 && value > balance ? (
        <p className="-mt-2 text-xs font-semibold text-warn">O valor é superior à dívida ({money(balance)}); a diferença fica como crédito a favor da loja.</p>
      ) : null}

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">Método</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {METHODS.map((m) => {
            const on = m.id === method;
            return (
              <label
                key={m.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--ring)]',
                  on ? 'border-transparent text-ink' : 'border-line text-ink-2 hover:bg-surface-2',
                )}
                style={on ? { background: `color-mix(in oklab, ${m.color} 16%, transparent)`, boxShadow: `inset 0 0 0 2px ${m.color}` } : undefined}
              >
                <input type="radio" name="payment-method" value={m.id} checked={on} onChange={() => setMethod(m.id)} className="sr-only" />
                <m.icon className="size-4 shrink-0" style={{ color: m.color }} aria-hidden />
                <span className="truncate">{PAYMENT_METHOD_LABEL[m.id]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field label="Referência" hint={method === 'MOBILE_MONEY' ? 'Código da transação M-Pesa / e-Mola.' : 'Opcional (n.º do talão, cheque ou transferência).'}>
        {(a) => <Input {...a} maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'MOBILE_MONEY' ? 'Ex.: MPESA-ABC123' : ''} />}
      </Field>
      <Field label="Notas">{(a) => <Textarea {...a} maxLength={500} rows={2} className="min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>

      <div className="sticky -bottom-5 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" icon={Wallet} loading={save.isPending}>
          Registar {value > 0 ? money(value) : 'cobrança'}
        </Button>
      </div>
    </form>
  );
}
