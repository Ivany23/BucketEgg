'use client';

import { LogOut, Timer } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Textarea, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { minutes } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import type { Visit } from '@/lib/types';
import { clock, getPosition, useNow } from './geo';
import { GeofenceBadge, ProductiveBadge, type ActiveVisit } from './shared';

interface CheckOutBody {
  lat?: number;
  lng?: number;
  notes?: string;
  noOrderReason?: string;
}

export const NO_ORDER_REASONS = ['Loja fechada', 'Stock suficiente', 'Sem dinheiro', 'Responsável ausente', 'Outro'] as const;

export function CheckoutModal({ open, onClose, visit }: { open: boolean; onClose: () => void; visit: ActiveVisit }) {
  const toast = useToast();
  const now = useNow();
  const group = useId();
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState<string>('');
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const needsReason = !visit.isProductive;

  const checkOut = useApiMutation((body: CheckOutBody) => api<Visit>(`/visits/${visit.id}/check-out`, { method: 'POST', body }), {
    invalidate: [['visits'], ['my-day'], ['dashboard'], ['outlets']],
    onSuccess: (v) => {
      toast.success(`Visita a ${visit.outlet.name} encerrada`, `Duração: ${minutes(v.durationMins)}${v.isProductive ? ' · com encomenda' : ''}`);
      onClose();
    },
    onError: (e) => toast.error('Não foi possível fazer o check-out', e.message),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let noOrderReason: string | undefined;
    if (needsReason) {
      noOrderReason = reason === 'Outro' ? other.trim() : reason;
      if (!noOrderReason) {
        setError(reason === 'Outro' ? 'Descreva o motivo.' : 'Escolha o motivo de não haver encomenda.');
        return;
      }
    }
    setError(null);
    // A localização no check-out é opcional: se o GPS falhar, regista sem ela.
    setLocating(true);
    const pos = await getPosition(8_000).catch(() => null);
    setLocating(false);
    checkOut.mutate({ lat: pos?.lat, lng: pos?.lng, notes: notes.trim() || undefined, noOrderReason: noOrderReason?.slice(0, 200) });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      module="dia"
      title="Check-out"
      description={visit.outlet.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="checkout-form" icon={LogOut} loading={locating || checkOut.isPending}>
            {locating ? 'A obter localização…' : 'Terminar visita'}
          </Button>
        </>
      }
    >
      <form id="checkout-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink tabular-nums">
            <Timer className="size-4 text-[var(--accent-text)]" aria-hidden />
            <span className="sr-only">Duração até agora:</span>
            {clock(now - Date.parse(visit.checkInAt))}
          </span>
          <GeofenceBadge within={visit.withinGeofence} distanceM={visit.distanceM} />
          <ProductiveBadge productive={visit.isProductive} open />
        </div>

        {needsReason ? (
          <fieldset aria-describedby={error ? `${group}-err` : undefined}>
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">
              Motivo de não haver encomenda <span className="text-bad">*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {NO_ORDER_REASONS.map((r) => {
                const active = reason === r;
                return (
                  <label
                    key={r}
                    className={cn(
                      'inline-flex cursor-pointer items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                      active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'border-line-strong text-ink-2 hover:bg-surface-2',
                    )}
                  >
                    <input
                      type="radio"
                      name={`${group}-reason`}
                      value={r}
                      checked={active}
                      onChange={() => {
                        setReason(r);
                        setError(null);
                      }}
                      className="sr-only"
                    />
                    {r}
                  </label>
                );
              })}
            </div>
            {reason === 'Outro' ? (
              <Field label="Qual o motivo?" required className="mt-3">
                {(a) => <Input {...a} maxLength={200} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Ex.: cliente pediu para voltar amanhã" />}
              </Field>
            ) : null}
            {error ? (
              <p id={`${group}-err`} role="alert" className="mt-2 text-xs font-medium text-bad">
                {error}
              </p>
            ) : null}
          </fieldset>
        ) : (
          <p className="rounded-2xl bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">Visita produtiva: já registou uma encomenda nesta visita.</p>
        )}

        <Field label="Notas da visita" hint="Opcional (ex.: pedido do cliente, observações da prateleira).">
          {(a) => <Textarea {...a} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
