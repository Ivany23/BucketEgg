'use client';

import { Ban, CheckCircle2, Clock, FilterX, Layers, PackageCheck, Plus, Receipt, ShoppingCart, TrendingUp, Truck, Wallet } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { OrderStatusBadge, RequireProject } from '@/components/domain';
import { NewOrderModal } from '@/components/sales/new-order-modal';
import { OrderDrawer } from '@/components/sales/order-drawer';
import { OutletPicker, type OutletRef } from '@/components/sales/outlet-picker';
import { PaymentModal } from '@/components/sales/payment-modal';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  ListSkeleton,
  PageHeader,
  Pagination,
  Select,
  StatTile,
  Table,
  Tabs,
  type Column,
  type TabItem,
} from '@/components/ui';
import { dateTime, int, money } from '@/lib/format';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import { ROLE_LABEL, type Member, type Order, type OrderStatus, type Page, type Project } from '@/lib/types';
import { addDays, useToday } from '@/lib/today';

type StatusTab = 'ALL' | Exclude<OrderStatus, 'DRAFT'>;
const PAGE_SIZE = 20;
/** Teto para os indicadores (a API aceita até 500 por página). */
const SUMMARY_LIMIT = 500;

export function OrdersScreen() {
  return <RequireProject>{(project) => <Orders project={project} />}</RequireProject>;
}

function Orders({ project }: { project: Project }) {
  const { isManager, isFieldRep } = useSession();
  const reduce = useReducedMotion();
  const [status, setStatus] = useState<StatusTab>('ALL');
  const today = useToday() ?? '';
  const [defaultFrom, defaultTo] = today ? [addDays(today, -30), today] : ['', ''];
  // undefined = ainda por escolher (vale o padrão: últimos 30 dias).
  const [pickedFrom, setFrom] = useState<string>();
  const [pickedTo, setTo] = useState<string>();
  const from = pickedFrom ?? defaultFrom;
  const to = pickedTo ?? defaultTo;
  const [userId, setUserId] = useState('');
  const [outlet, setOutlet] = useState<OutletRef | null>(null);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [payment, setPayment] = useState<{ outlet: OutletRef | null } | null>(null);

  const rangeError = from && to && from > to ? 'A data inicial tem de ser anterior à final.' : null;
  const filtersActive = status !== 'ALL' || from !== defaultFrom || to !== defaultTo || !!userId || !!outlet;
  const base = { from: from || undefined, to: to || undefined, userId: userId || undefined, outletId: outlet?.id };
  const path = rangeError ? null : `/projects/${project.id}/orders`;

  const list = useApi<Page<Order>>(['orders', project.id, 'list', status, page, base], path, {
    ...base,
    status: status === 'ALL' ? undefined : status,
    page,
    limit: PAGE_SIZE,
  });
  // Os mesmos filtros sem estado nem paginação: contagens dos separadores e indicadores.
  const summary = useApi<Page<Order>>(['orders', project.id, 'summary', base], path, { ...base, limit: SUMMARY_LIMIT });
  const team = useApi<Member[]>(['team'], isManager ? '/team' : null, undefined, { staleTime: 5 * 60_000 });

  const stats = useMemo(() => {
    const rows = summary.data?.data ?? [];
    const count: Record<StatusTab, number> = { ALL: rows.length, SUBMITTED: 0, CONFIRMED: 0, DELIVERED: 0, CANCELLED: 0 };
    for (const o of rows) if (o.status !== 'DRAFT') count[o.status] += 1;
    const scoped = status === 'ALL' ? rows : rows.filter((o) => o.status === status);
    const live = scoped.filter((o) => o.status !== 'CANCELLED');
    const revenue = live.reduce((s, o) => s + o.total, 0);
    const cancelled = scoped.filter((o) => o.status === 'CANCELLED');
    return {
      count,
      total: scoped.length,
      revenue,
      avg: live.length ? revenue / live.length : 0,
      cancelled: cancelled.length,
      cancelledValue: cancelled.reduce((s, o) => s + o.total, 0),
      partial: (summary.data?.meta.total ?? 0) > rows.length,
    };
  }, [summary.data, status]);

  const tabs: TabItem<StatusTab>[] = [
    { id: 'ALL', label: 'Todas', icon: Layers, count: summary.data ? stats.count.ALL : undefined },
    { id: 'SUBMITTED', label: 'Submetidas', icon: Clock, count: summary.data ? stats.count.SUBMITTED : undefined },
    { id: 'CONFIRMED', label: 'Confirmadas', icon: PackageCheck, count: summary.data ? stats.count.CONFIRMED : undefined },
    { id: 'DELIVERED', label: 'Entregues', icon: Truck, count: summary.data ? stats.count.DELIVERED : undefined },
    { id: 'CANCELLED', label: 'Canceladas', icon: Ban, count: summary.data ? stats.count.CANCELLED : undefined },
  ];

  const members = useMemo(
    () =>
      [...(team.data ?? [])]
        .filter((m) => m.isActive)
        .sort((a, b) => Number(b.role === 'FIELD_REP') - Number(a.role === 'FIELD_REP') || (a.user.name ?? a.user.email).localeCompare(b.user.name ?? b.user.email, 'pt')),
    [team.data],
  );

  const resetFilters = () => {
    setStatus('ALL');
    setFrom(defaultFrom);
    setTo(defaultTo);
    setUserId('');
    setOutlet(null);
    setPage(1);
  };
  const withReset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Encomenda',
      cell: (o) => (
        <span className="font-mono text-[13px] font-bold text-ink">
          {o.number}
          <span className="mt-0.5 block font-sans text-xs font-normal text-ink-3">{dateTime(o.createdAt)}</span>
        </span>
      ),
    },
    { key: 'outlet', header: 'Loja', cell: (o) => <span className="font-semibold">{o.outlet.name}</span> },
    {
      key: 'user',
      header: 'Promotor',
      hideOnMobile: true,
      cell: (o) => (
        <span className="flex items-center gap-2">
          <Avatar name={o.user.name} email={o.user.email} size={28} />
          <span className="truncate text-ink-2">{o.user.name ?? '—'}</span>
        </span>
      ),
    },
    { key: 'items', header: 'Itens', align: 'center', cell: (o) => <span className="tabular-nums text-ink-2">{o._count?.items ?? '—'}</span> },
    { key: 'total', header: 'Total', align: 'right', cell: (o) => <span className={o.status === 'CANCELLED' ? 'text-ink-3 line-through' : 'font-bold'}>{money(o.total)}</span> },
    { key: 'status', header: 'Estado', cell: (o) => <OrderStatusBadge status={o.status} /> },
  ];

  const rows = list.data?.data ?? [];

  return (
    <>
      <PageHeader
        icon={ShoppingCart}
        eyebrow={project.name}
        title="Encomendas"
        description={isFieldRep ? 'As suas encomendas, o estado de cada uma e as cobranças às lojas.' : 'Encomendas da equipa, estados de entrega e cobranças às lojas.'}
        actions={
          <>
            <Button icon={Wallet} onClick={() => setPayment({ outlet: null })}>
              Registar cobrança
            </Button>
            <Button variant="accent" icon={Plus} onClick={() => setNewOpen(true)}>
              Nova encomenda
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile index={0} label="Encomendas" value={stats.total} format={(v) => int(Math.round(v))} icon={Receipt} color="var(--m-vendas)" hint={statusHint(status)} />
        <StatTile index={1} label="Receita" value={stats.revenue} format={money} icon={TrendingUp} color="var(--m-visitas)" hint="Sem canceladas, com IVA" />
        <StatTile index={2} label="Ticket médio" value={stats.avg} format={money} icon={CheckCircle2} color="var(--m-rotas)" hint="Por encomenda válida" />
        <StatTile
          index={3}
          label="Canceladas"
          value={stats.cancelled}
          format={(v) => int(Math.round(v))}
          icon={Ban}
          color="var(--bad)"
          hint={stats.cancelledValue > 0 ? `${money(stats.cancelledValue)} devolvidos` : 'Nenhuma no período'}
        />
      </div>
      {stats.partial ? <p className="-mt-4 mb-4 text-xs text-ink-3">Indicadores calculados sobre as {SUMMARY_LIMIT} encomendas mais recentes do período.</p> : null}

      <Card className="mb-4 p-3 sm:p-4">
        <Tabs tabs={tabs} value={status} onChange={withReset(setStatus)} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,150px))_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <Field label="De" error={rangeError}>
            {(a) => <Input {...a} type="date" value={from} max={to || undefined} onChange={(e) => withReset(setFrom)(e.target.value)} />}
          </Field>
          <Field label="Até">{(a) => <Input {...a} type="date" value={to} min={from || undefined} onChange={(e) => withReset(setTo)(e.target.value)} />}</Field>
          {isManager ? (
            <Field label="Promotor">
              {(a) => (
                <Select {...a} value={userId} onChange={(e) => withReset(setUserId)(e.target.value)} disabled={team.isPending}>
                  <option value="">Toda a equipa</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name ?? m.user.email}
                      {m.role !== 'FIELD_REP' ? ` (${ROLE_LABEL[m.role]})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <div className={isManager ? '' : 'lg:col-span-2'}>
            <OutletPicker projectId={project.id} label="Loja" status={null} value={outlet} onChange={withReset(setOutlet)} placeholder="Todas as lojas" />
          </div>
          {filtersActive ? (
            <Button variant="ghost" icon={FilterX} onClick={resetFilters} className="sm:col-span-2 lg:col-span-1">
              Limpar
            </Button>
          ) : null}
        </div>
      </Card>

      {rangeError ? (
        <EmptyState compact illustration="calendar" title="Período inválido" description={rangeError} />
      ) : list.isPending ? (
        <ListSkeleton rows={6} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          illustration="cart"
          title={filtersActive ? 'Nenhuma encomenda com estes filtros' : 'Ainda não há encomendas'}
          description={
            filtersActive
              ? 'Experimente outro período, estado ou loja.'
              : 'As encomendas tiradas nas visitas aparecem aqui. Registe a primeira agora.'
          }
          action={
            filtersActive ? (
              <Button icon={FilterX} onClick={resetFilters}>
                Limpar filtros
              </Button>
            ) : (
              <Button variant="accent" icon={Plus} onClick={() => setNewOpen(true)}>
                Nova encomenda
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Telemóvel: cartões */}
          <ul className="flex flex-col gap-2.5 md:hidden">
            {rows.map((o, i) => (
              <motion.li
                key={o.id}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.035, type: 'spring', stiffness: 280, damping: 26 }}
              >
                <OrderCard order={o} onOpen={() => setOpenId(o.id)} />
              </motion.li>
            ))}
          </ul>
          {/* Ecrã largo: tabela */}
          <div className="hidden md:block">
            <Table columns={columns} rows={rows} rowKey={(o) => o.id} onRowClick={(o) => setOpenId(o.id)} rowLabel={(o) => `Abrir encomenda ${o.number} de ${o.outlet.name}`} />
          </div>
          <Pagination page={page} pages={list.data?.meta.pages ?? 1} total={list.data?.meta.total} onChange={setPage} />
        </>
      )}

      <OrderDrawer
        orderId={openId}
        onClose={() => setOpenId(null)}
        blockClose={!!payment}
        onRegisterPayment={(o) => setPayment({ outlet: o })}
      />
      <NewOrderModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        projectId={project.id}
        onCreated={(o) => {
          setNewOpen(false);
          setOpenId(o.id);
        }}
      />
      <PaymentModal open={!!payment} onClose={() => setPayment(null)} projectId={project.id} outlet={payment?.outlet} />
    </>
  );
}

function statusHint(s: StatusTab) {
  return { ALL: 'Todos os estados', SUBMITTED: 'Por confirmar', CONFIRMED: 'Por entregar', DELIVERED: 'Entregues', CANCELLED: 'Canceladas' }[s];
}

function OrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir encomenda ${order.number} de ${order.outlet.name}`}
      whileHover={reduce ? undefined : { y: -3 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="shadow-soft flex w-full items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left transition-shadow hover:shadow-lift"
    >
      <span aria-hidden className="mt-0.5 h-10 w-1 shrink-0 rounded-full" style={{ background: STATUS_COLOR[order.status] }} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-mono text-[13px] font-bold text-ink">{order.number}</span>
          <OrderStatusBadge status={order.status} />
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{order.outlet.name}</span>
        <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={order.user.name} email={order.user.email} size={20} />
            <span className="truncate">
              {dateTime(order.createdAt)} · {order._count?.items ?? 0} {order._count?.items === 1 ? 'item' : 'itens'}
            </span>
          </span>
          <span className={order.status === 'CANCELLED' ? 'text-sm text-ink-3 line-through' : 'text-sm font-extrabold text-ink tabular-nums'}>{money(order.total)}</span>
        </span>
      </span>
    </motion.button>
  );
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  DRAFT: 'var(--text-3)',
  SUBMITTED: 'var(--m-rotas)',
  CONFIRMED: 'var(--m-beats)',
  DELIVERED: 'var(--m-visitas)',
  CANCELLED: 'var(--bad)',
};
