'use client';

import { LogOut, ShoppingCart, Store, Timer, Wallet } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { time } from '@/lib/format';
import { CheckoutModal } from './checkout-modal';
import { clock, useNow } from './geo';
import { OrderModal } from './order-modal';
import { PaymentModal } from './payment-modal';
import { GeofenceBadge, ProductiveBadge, type ActiveVisit } from './shared';

type Dialog = 'order' | 'payment' | 'checkout' | null;

/** Faixa da visita em curso: cronómetro, geofence e ações (encomenda, cobrança, check-out). */
export function ActiveVisitBanner({ visit }: { visit: ActiveVisit }) {
  const reduce = useReducedMotion();
  const now = useNow();
  const [dialog, setDialog] = useState<Dialog>(null);
  // Cada abertura monta um formulário novo (estado limpo).
  const [opening, setOpening] = useState(0);
  const openDialog = (d: Dialog) => {
    setOpening((n) => n + 1);
    setDialog(d);
  };
  const close = () => setDialog(null);

  return (
    <motion.section
      aria-label="Visita em curso"
      initial={reduce ? false : { opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="shadow-lift relative overflow-hidden rounded-3xl border border-[color-mix(in_oklab,var(--m-dia)_40%,transparent)] p-4 sm:p-5"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in oklab, var(--m-dia) 22%, var(--surface)) 0%, color-mix(in oklab, var(--m-painel) 14%, var(--surface)) 55%, color-mix(in oklab, var(--m-vendas) 10%, var(--surface)) 100%)',
      }}
    >
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-8 size-40 rounded-full opacity-30 blur-2xl" style={{ background: 'var(--m-dia)' }} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-[var(--m-dia-text)] shadow-soft">
            <Store className="size-6" aria-hidden />
            <span aria-hidden className="absolute -top-1 -right-1 flex size-3.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-3.5 rounded-full border-2 border-surface bg-ok" />
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-[var(--m-dia-text)] uppercase">Visita em curso · desde {time(visit.checkInAt)}</p>
            <h2 className="truncate text-lg font-extrabold text-ink">{visit.outlet.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-0.5 text-sm font-bold text-ink tabular-nums" role="timer" aria-live="off">
                <Timer className="size-4 text-[var(--m-dia-text)]" aria-hidden />
                <span className="sr-only">Tempo na loja:</span>
                {clock(now - Date.parse(visit.checkInAt))}
              </span>
              <GeofenceBadge within={visit.withinGeofence} distanceM={visit.distanceM} />
              <ProductiveBadge productive={visit.isProductive} open />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button variant="primary" size="lg" icon={ShoppingCart} onClick={() => openDialog('order')} className="col-span-2 sm:h-10 sm:text-sm">
            Registar encomenda
          </Button>
          <Button variant="secondary" icon={Wallet} onClick={() => openDialog('payment')}>
            Cobrança
          </Button>
          <Button variant="secondary" icon={LogOut} onClick={() => openDialog('checkout')}>
            Check-out
          </Button>
        </div>
      </div>

      <OrderModal
        key={`o${opening}`}
        open={dialog === 'order'}
        onClose={close}
        outletId={visit.outletId}
        outletName={visit.outlet.name}
        visitId={visit.id}
        onRequestPayment={() => openDialog('payment')}
      />
      <PaymentModal key={`p${opening}`} open={dialog === 'payment'} onClose={close} outletId={visit.outletId} outletName={visit.outlet.name} />
      <CheckoutModal key={`c${opening}`} open={dialog === 'checkout'} onClose={close} visit={visit} />
    </motion.section>
  );
}
