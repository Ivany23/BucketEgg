'use client';

import { Ban, MapPin, PackageCheck, Phone, StickyNote, Store, Truck, Wallet, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import { OrderStatusBadge } from '@/components/domain';
import { Avatar, Button, Drawer, ErrorState, Skeleton, useConfirm, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Order, OrderDetail, OrderItem, OrderStatus } from '@/lib/types';
import { ORDER_TRANSITIONS, OrderTimeline } from './order-timeline';
import type { OutletRef } from './outlet-picker';

const ACTION: Partial<Record<OrderStatus, { label: string; icon: LucideIcon; done: string }>> = {
  CONFIRMED: { label: 'Confirmar encomenda', icon: PackageCheck, done: 'Encomenda confirmada' },
  DELIVERED: { label: 'Marcar como entregue', icon: Truck, done: 'Encomenda entregue' },
  CANCELLED: { label: 'Cancelar', icon: Ban, done: 'Encomenda cancelada' },
};

/** Detalhe da encomenda (itens, totais, estado) e mudança de estado para supervisores. */
export function OrderDrawer({
  orderId,
  onClose,
  onRegisterPayment,
  blockClose,
}: {
  orderId: string | null;
  onClose: () => void;
  onRegisterPayment: (outlet: OutletRef) => void;
  /** Há um diálogo aberto por cima (Esc fecha só esse). */
  blockClose?: boolean;
}) {
  const confirming = useRef(false);
  const q = useApi<OrderDetail>(['order', orderId], orderId ? `/orders/${orderId}` : null);
  const order = q.data;
  return (
    <Drawer
      open={!!orderId}
      onClose={() => {
        if (!blockClose && !confirming.current) onClose();
      }}
      module="vendas"
      width="lg"
      title={order ? <span className="font-mono tracking-tight">{order.number}</span> : 'Encomenda'}
      subtitle={
        order ? (
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="text-xs text-ink-3">Criada {dateTime(order.createdAt)}</span>
          </span>
        ) : null
      }
      footer={order ? <OrderActions
            order={order}
            onConfirming={(v) => {
              confirming.current = v;
            }}
            onRefetch={() => void q.refetch()} onRegisterPayment={onRegisterPayment} /> : null}
    >
      {q.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="A carregar a encomenda">
          <Skeleton className="h-20" />
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : order ? (
        <OrderBody order={order} />
      ) : null}
    </Drawer>
  );
}

function OrderBody({ order }: { order: OrderDetail }) {
  const reduce = useReducedMotion();
  const section = (i: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.05 + i * 0.05, type: 'spring' as const, stiffness: 280, damping: 26 } };
  return (
    <div className="flex flex-col gap-5">
      <motion.section {...section(0)} className="rounded-2xl border border-line bg-surface-2/50 px-3 pt-4 pb-3">
        <OrderTimeline status={order.status} createdAt={order.createdAt} updatedAt={order.updatedAt} />
      </motion.section>

      <motion.section {...section(1)} className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-2xl border border-line p-3.5">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--m-lojas-soft)', color: 'var(--m-lojas-text)' }}>
            <Store className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 text-sm">
            <p className="text-xs font-semibold text-ink-3">Loja</p>
            <p className="font-bold text-ink">{order.outlet.name}</p>
            {order.outlet.address ? (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-ink-2">
                <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
                {order.outlet.address}
              </p>
            ) : null}
            {order.outlet.phone ? (
              <a href={`tel:${order.outlet.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)] hover:underline">
                <Phone className="size-3" aria-hidden />
                {order.outlet.phone}
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex gap-3 rounded-2xl border border-line p-3.5">
          <Avatar name={order.user.name} email={order.user.email} size={40} />
          <div className="min-w-0 text-sm">
            <p className="text-xs font-semibold text-ink-3">Promotor</p>
            <p className="font-bold text-ink">{order.user.name ?? order.user.email ?? '—'}</p>
            {order.user.email ? <p className="truncate text-xs text-ink-2">{order.user.email}</p> : null}
          </div>
        </div>
      </motion.section>

      <motion.section {...section(2)} aria-labelledby="order-items-title">
        <h3 id="order-items-title" className="mb-2 text-sm font-bold text-ink">
          Produtos <span className="font-medium text-ink-3">({order.items.length})</span>
        </h3>
        <ItemsTable items={order.items} />
      </motion.section>

      <motion.section {...section(3)} className="rounded-2xl p-4" style={{ background: 'var(--accent-soft)' }} aria-label="Totais">
        <dl className="flex flex-col gap-1.5 text-sm">
          <Row label="Subtotal" value={money(order.subtotal)} />
          <Row label="Desconto" value={order.discount > 0 ? `− ${money(order.discount)}` : money(0)} tone={order.discount > 0 ? 'text-ok' : undefined} />
          <Row label="IVA" value={money(order.tax)} />
          <div className="mt-1 flex items-baseline justify-between border-t border-[color-mix(in_oklab,var(--accent)_30%,transparent)] pt-2">
            <dt className="font-bold text-ink">Total</dt>
            <dd className="text-xl font-extrabold text-[var(--accent-text)] tabular-nums">{money(order.total)}</dd>
          </div>
        </dl>
      </motion.section>

      {order.notes ? (
        <motion.section {...section(4)} className="flex gap-3 rounded-2xl border border-dashed border-line-strong p-3.5">
          <StickyNote className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--m-dia)' }} aria-hidden />
          <div>
            <p className="text-xs font-semibold text-ink-3">Notas</p>
            <p className="text-sm whitespace-pre-line text-ink">{order.notes}</p>
          </div>
        </motion.section>
      ) : null}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`font-semibold tabular-nums ${tone ?? 'text-ink'}`}>{value}</dd>
    </div>
  );
}

const discountPct = (i: OrderItem) => {
  const gross = i.quantity * i.unitPrice;
  return gross > 0 ? Math.round((i.discount / gross) * 1000) / 10 : 0;
};
const lineTax = (i: OrderItem) => Math.max(0, i.lineTotal - (i.quantity * i.unitPrice - i.discount));

function ItemsTable({ items }: { items: OrderItem[] }) {
  return (
    <>
      {/* Telemóvel: uma linha por produto */}
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line sm:hidden">
        {items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{i.product.name}</p>
              <p className="font-mono text-[11px] text-ink-3">{i.product.sku}</p>
              <p className="mt-1 text-xs text-ink-2">
                {i.quantity.toLocaleString('pt-PT')} {i.product.unit ?? ''} × {money(i.unitPrice)}
                {i.discount > 0 ? ` · desc. ${discountPct(i)}%` : ''} · IVA {i.taxRate}%
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-ink tabular-nums">{money(i.lineTotal)}</p>
          </li>
        ))}
      </ul>
      {/* Ecrã largo: tabela */}
      <div className="scrollbar-thin hidden overflow-x-auto rounded-2xl border border-line sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left text-[11px] font-bold tracking-wide text-ink-3 uppercase">
              <th scope="col" className="px-3 py-2.5">Produto</th>
              <th scope="col" className="px-3 py-2.5 text-right">Qtd.</th>
              <th scope="col" className="px-3 py-2.5 text-right">Preço</th>
              <th scope="col" className="px-3 py-2.5 text-right">Desconto</th>
              <th scope="col" className="px-3 py-2.5 text-right">IVA</th>
              <th scope="col" className="px-3 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-ink">{i.product.name}</p>
                  <p className="font-mono text-[11px] text-ink-3">{i.product.sku}</p>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {i.quantity.toLocaleString('pt-PT')} <span className="text-xs text-ink-3">{i.product.unit}</span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(i.unitPrice)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {i.discount > 0 ? (
                    <>
                      <span className="text-ok">− {money(i.discount)}</span>
                      <span className="block text-[11px] text-ink-3">{discountPct(i)}%</span>
                    </>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {money(lineTax(i))}
                  <span className="block text-[11px] text-ink-3">{i.taxRate}%</span>
                </td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{money(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OrderActions({
  order,
  onConfirming,
  onRefetch,
  onRegisterPayment,
}: {
  order: OrderDetail;
  /** Avisa o painel de que há uma confirmação aberta (o Esc não deve fechar o painel). */
  onConfirming: (open: boolean) => void;
  onRefetch: () => void;
  onRegisterPayment: (outlet: OutletRef) => void;
}) {
  const { isManager } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const change = useApiMutation(
    (status: OrderStatus) => api<Order>(`/orders/${order.id}/status`, { method: 'PATCH', body: { status } }),
    {
      invalidate: [['orders'], ['order', order.id], ['statement'], ['outlets'], ['outlet'], ['dashboard']],
      onSuccess: (_, status) => {
        const a = ACTION[status];
        if (status === 'CANCELLED') toast.success(a?.done ?? 'Estado atualizado', `${money(order.total)} devolvidos ao saldo de ${order.outlet.name}.`);
        else toast.success(a?.done ?? 'Estado atualizado', order.number);
      },
      onError: (e: ApiError) => {
        if (e.status === 409) {
          toast.warn('A encomenda mudou entretanto', 'Recarregámos o estado atual. Verifique e tente de novo.');
        } else {
          toast.error('Não foi possível mudar o estado', e.message);
        }
        onRefetch();
      },
    },
  );

  const run = async (status: OrderStatus) => {
    if (status === 'CANCELLED') {
      onConfirming(true);
      const ok = await confirm({
        title: `Cancelar a encomenda ${order.number}?`,
        description: (
          <>
            O total de <strong>{money(order.total)}</strong> é devolvido ao saldo da loja <strong>{order.outlet.name}</strong> (a dívida baixa) e a
            encomenda deixa de contar nas vendas.
          </>
        ),
        confirmLabel: 'Cancelar encomenda',
        danger: true,
      });
      // Deixa passar o Esc que fechou a confirmação antes de voltar a permitir fechar o painel.
      setTimeout(() => onConfirming(false), 0);
      if (!ok) return;
    }
    change.mutate(status);
  };

  const next = isManager ? ORDER_TRANSITIONS[order.status].filter((s) => s !== 'SUBMITTED') : [];
  const forward = next.filter((s) => s !== 'CANCELLED');
  const canCancel = next.includes('CANCELLED');
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        icon={Wallet}
        onClick={() => onRegisterPayment({ id: order.outlet.id, name: order.outlet.name, address: order.outlet.address })}
      >
        Registar cobrança
      </Button>
      <span className="flex-1" />
      {canCancel ? (
        <Button variant="ghost" className="text-bad hover:bg-bad-soft hover:text-bad" icon={Ban} disabled={change.isPending} onClick={() => void run('CANCELLED')}>
          Cancelar
        </Button>
      ) : null}
      {forward.map((s) => {
        const a = ACTION[s];
        return (
          <Button key={s} variant="accent" icon={a?.icon} loading={change.isPending && change.variables === s} disabled={change.isPending} onClick={() => void run(s)}>
            {a?.label ?? s}
          </Button>
        );
      })}
    </div>
  );
}
