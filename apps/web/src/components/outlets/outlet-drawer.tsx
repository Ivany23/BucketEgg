'use client';

import {
  Activity,
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Gauge,
  Layers,
  MapPin,
  MapPinOff,
  Navigation,
  Pencil,
  Phone,
  Receipt,
  Repeat,
  ShoppingCart,
  Trash2,
  UserRound,
  Wallet,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { OrderStatusBadge, OutletStatusBadge } from '@/components/domain';
import { MapView } from '@/components/map';
import { Badge, Button, Drawer, EmptyState, ErrorState, ListSkeleton, Skeleton, StatTile, Tabs, cn, useConfirm, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { ago, date, dateTime, minutes, money } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import { PAYMENT_METHOD_LABEL, type OutletDetail, type Statement } from '@/lib/types';
import { useReviewOutlet } from './approval-tab';
import { ClassBadge, CreditBar, creditUsage, directionsHref, hasCoords, telHref } from './meta';
import { EditOutletModal } from './outlet-form';
import { PaymentModal } from './payment-modal';

type Tab = 'resumo' | 'extrato' | 'atividade';

export function OutletDrawer({ outletId, onClose }: { outletId: string | null; onClose: () => void }) {
  const { isManager } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('resumo');
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const q = useApi<OutletDetail>(['outlet', outletId], outletId ? `/outlets/${outletId}` : null);
  const outlet = q.data;
  const review = useReviewOutlet();

  const remove = useApiMutation((id: string) => api<{ deleted: boolean }>(`/outlets/${id}`, { method: 'DELETE' }), {
    invalidate: [['outlets'], ['dashboard']],
    onSuccess: () => {
      toast.success('Loja apagada');
      onClose();
    },
    onError: (e) => toast.error('Não foi possível apagar a loja', e.message),
  });

  const close = () => {
    setTab('resumo');
    onClose();
  };

  const askDelete = async () => {
    if (!outlet) return;
    const ok = await confirm({
      title: `Apagar "${outlet.name}"?`,
      description: 'A loja deixa de aparecer em rotas, beats e relatórios. Prefira marcá-la como Inativa se ainda tiver histórico.',
      confirmLabel: 'Apagar loja',
      danger: true,
    });
    if (ok) remove.mutate(outlet.id);
  };

  const pending = outlet?.status === 'PENDING_APPROVAL';
  const reviewBusy = review.isPending;

  return (
    <>
      <Drawer
        open={!!outletId && !paying && !editing}
        onClose={close}
        width="lg"
        module="lojas"
        title={outlet?.name ?? 'Loja'}
        subtitle={
          outlet ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <OutletStatusBadge status={outlet.status} />
              <ClassBadge value={outlet.outletClass} />
              <span className="text-xs text-ink-3">{[outlet.code, outlet.channel, outlet.zone].filter(Boolean).join(' · ')}</span>
            </span>
          ) : null
        }
        footer={
          outlet ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              {isManager ? (
                <Button variant="ghost" icon={Trash2} className="text-bad" loading={remove.isPending} onClick={() => void askDelete()}>
                  Apagar
                </Button>
              ) : null}
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                {isManager && pending ? (
                  <>
                    <Button
                      variant="secondary"
                      icon={X}
                      className="text-bad"
                      disabled={reviewBusy}
                      loading={reviewBusy && review.variables?.status === 'REJECTED'}
                      onClick={() => review.mutate({ id: outlet.id, status: 'REJECTED', name: outlet.name })}
                    >
                      Rejeitar
                    </Button>
                    <Button
                      variant="accent"
                      icon={Check}
                      disabled={reviewBusy}
                      loading={reviewBusy && review.variables?.status === 'ACTIVE'}
                      onClick={() => review.mutate({ id: outlet.id, status: 'ACTIVE', name: outlet.name })}
                    >
                      Aprovar
                    </Button>
                  </>
                ) : null}
                {isManager ? (
                  <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                    Editar
                  </Button>
                ) : null}
                <Button variant="primary" icon={Banknote} onClick={() => setPaying(true)}>
                  Registar cobrança
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !outlet ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <ListSkeleton rows={3} />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <Tabs<Tab>
              tabs={[
                { id: 'resumo', label: 'Resumo', icon: Layers },
                { id: 'extrato', label: 'Extrato', icon: Receipt },
                { id: 'atividade', label: 'Atividade', icon: Activity },
              ]}
              value={tab}
              onChange={setTab}
            />
            <div role="tabpanel">
              {tab === 'resumo' ? <Summary outlet={outlet} /> : tab === 'extrato' ? <StatementView outletId={outlet.id} /> : <ActivityView outlet={outlet} />}
            </div>
          </div>
        )}
      </Drawer>
      <PaymentModal outlet={outlet ?? null} open={paying} onClose={() => setPaying(false)} />
      <EditOutletModal outlet={outlet ?? null} open={editing} onClose={() => setEditing(false)} />
    </>
  );
}

/* ───────────────────────────── Resumo ───────────────────────────── */

function Kpi({ icon: Icon, label, value, hint, color, index }: { icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; color: string; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 320, damping: 26 }}
      className="rounded-2xl border border-line bg-surface p-3"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-2">
        <span className="inline-flex size-7 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}>
          <Icon className="size-3.5" aria-hidden />
        </span>
        {label}
      </div>
      <div className="mt-2 text-lg leading-tight font-extrabold text-ink tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-ink-3">{hint}</div> : null}
    </motion.div>
  );
}

function Summary({ outlet }: { outlet: OutletDetail }) {
  const { warn } = creditUsage(outlet);
  const coords = hasCoords(outlet) ? { lat: outlet.latitude, lng: outlet.longitude } : null;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi index={0} icon={Wallet} label="Saldo" color={warn ? 'var(--bad)' : 'var(--m-vendas)'} value={money(outlet.balance)} hint={outlet.balance < 0 ? 'Crédito a favor da loja' : 'Em dívida'} />
        <Kpi index={1} icon={CreditCard} label="Limite de crédito" color="var(--m-lojas)" value={outlet.creditLimit > 0 ? money(outlet.creditLimit) : 'Sem crédito'} />
        <Kpi
          index={2}
          icon={Clock}
          label="Última visita"
          color="var(--m-visitas)"
          value={outlet.lastVisitedAt ? ago(outlet.lastVisitedAt) : 'Nunca'}
          hint={outlet.lastVisitedAt ? date(outlet.lastVisitedAt) : 'Ainda não visitada'}
        />
        <Kpi index={3} icon={Repeat} label="Frequência" color="var(--m-rotas)" value={`${outlet.visitFrequencyDays} dias`} hint="Intervalo alvo entre visitas" />
        <Kpi
          index={4}
          icon={Gauge}
          label="Potencial"
          color="var(--m-dia)"
          value={
            <span className="flex items-center gap-2">
              {outlet.potentialScore.toLocaleString('pt-PT')}
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full bg-[var(--m-dia)]" style={{ width: `${Math.min(100, outlet.potentialScore)}%` }} />
              </span>
            </span>
          }
          hint="Escala 0–100"
        />
        <Kpi index={5} icon={CalendarClock} label="Registada" color="var(--m-config)" value={date(outlet.createdAt)} hint={`Atualizada ${ago(outlet.updatedAt)}`} />
      </div>

      {outlet.creditLimit > 0 || outlet.balance > 0 ? (
        <div className="rounded-2xl border border-line bg-surface-2/50 p-3">
          <p className="mb-2 text-xs font-semibold text-ink-2">Utilização do crédito</p>
          <CreditBar outlet={outlet} />
        </div>
      ) : null}

      <section aria-labelledby="contacto" className="flex flex-col gap-3">
        <h3 id="contacto" className="text-sm font-bold text-ink">
          Contacto e localização
        </h3>
        <dl className="grid gap-3 rounded-2xl border border-line p-4 text-sm sm:grid-cols-2">
          <InfoRow icon={UserRound} label="Contacto" value={outlet.contactName} />
          <InfoRow icon={Phone} label="Telefone" value={outlet.phone} />
          <InfoRow icon={MapPin} label="Morada" value={outlet.address} className="sm:col-span-2" />
          <InfoRow icon={Layers} label="Zona" value={outlet.zone} />
          <InfoRow icon={ShoppingCart} label="Canal" value={outlet.channel} />
          {outlet.beatStops.length ? (
            <InfoRow icon={Repeat} label="Beats" value={outlet.beatStops.map((b) => b.beat?.name ?? '—').join(', ')} className="sm:col-span-2" />
          ) : null}
        </dl>
        <div className="flex flex-wrap gap-2">
          {outlet.phone ? (
            <a
              href={telHref(outlet.phone)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent-soft)] px-4 text-sm font-semibold text-[var(--accent-text)] transition hover:brightness-95"
            >
              <Phone className="size-4" aria-hidden />
              Ligar
            </a>
          ) : null}
          {coords ? (
            <a
              href={directionsHref(coords.lat, coords.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-2"
            >
              <Navigation className="size-4" aria-hidden />
              Navegar
              <span className="sr-only">(abre o Google Maps)</span>
            </a>
          ) : null}
        </div>
        {coords ? (
          <MapView points={[{ id: outlet.id, lat: coords.lat, lng: coords.lng, label: outlet.name, color: 'var(--m-lojas)' }]} height={220} />
        ) : (
          <p className="flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-3">
            <MapPinOff className="size-4" aria-hidden />
            Sem coordenadas GPS. Edite a loja para a colocar no mapa.
          </p>
        )}
      </section>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, className }: { icon: LucideIcon; label: string; value: string | null; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-start gap-2.5', className)}>
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--accent-text)]" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-ink-3">{label}</dt>
        <dd className={cn('break-words font-medium', value ? 'text-ink' : 'text-ink-3')}>{value || '—'}</dd>
      </div>
    </div>
  );
}

/* ───────────────────────────── Extrato ───────────────────────────── */

function StatementView({ outletId }: { outletId: string }) {
  const q = useApi<Statement>(['outlet', outletId, 'statement'], `/outlets/${outletId}/statement`);
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending)
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <ListSkeleton rows={3} />
      </div>
    );
  const s = q.data;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile index={0} label="Encomendado" value={s.totalOrdered} format={money} icon={ShoppingCart} color="var(--m-vendas)" />
        <StatTile index={1} label="Pago" value={s.totalPaid} format={money} icon={Banknote} color="var(--m-visitas)" />
        <StatTile
          index={2}
          label="Saldo"
          value={s.balance}
          format={money}
          icon={Wallet}
          color={s.outlet.creditLimit > 0 && s.balance > s.outlet.creditLimit * 0.8 ? 'var(--bad)' : 'var(--m-lojas)'}
          hint={s.outlet.creditLimit > 0 ? `Limite ${money(s.outlet.creditLimit)}` : 'Sem limite de crédito'}
        />
      </div>

      <section aria-labelledby="extrato-enc" className="flex flex-col gap-2">
        <h3 id="extrato-enc" className="inline-flex items-center gap-2 text-sm font-bold text-ink">
          <ShoppingCart className="size-4 text-[var(--m-vendas)]" aria-hidden /> Encomendas
        </h3>
        {s.orders.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {s.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="font-semibold text-ink tabular-nums">{o.number}</span>
                <OrderStatusBadge status={o.status} />
                <span className="text-xs text-ink-3">{dateTime(o.createdAt)}</span>
                <span className="ml-auto font-bold text-ink tabular-nums">{money(o.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-3">Sem encomendas registadas.</p>
        )}
      </section>

      <section aria-labelledby="extrato-pag" className="flex flex-col gap-2">
        <h3 id="extrato-pag" className="inline-flex items-center gap-2 text-sm font-bold text-ink">
          <Banknote className="size-4 text-[var(--m-visitas)]" aria-hidden /> Cobranças
        </h3>
        {s.payments.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {s.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <Badge tone="ok" icon={CheckCircle2}>
                  {PAYMENT_METHOD_LABEL[p.method]}
                </Badge>
                <span className="text-xs text-ink-3">{dateTime(p.createdAt)}</span>
                {p.reference ? <span className="text-xs text-ink-2">Ref. {p.reference}</span> : null}
                <span className="ml-auto font-bold text-ok tabular-nums">−{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-3">Sem cobranças registadas.</p>
        )}
      </section>
    </div>
  );
}

/* ───────────────────────────── Atividade ───────────────────────────── */

interface TimelineEvent {
  id: string;
  at: string;
  icon: LucideIcon;
  color: string;
  title: ReactNode;
  detail?: ReactNode;
}

function ActivityView({ outlet }: { outlet: OutletDetail }) {
  const reduce = useReducedMotion();
  const events = useMemo<TimelineEvent[]>(() => {
    const visits: TimelineEvent[] = outlet.visits.map((v) => ({
      id: `v-${v.id}`,
      at: v.checkInAt,
      icon: v.isProductive ? CheckCircle2 : v.checkOutAt ? XCircle : ClipboardList,
      color: v.isProductive ? 'var(--m-visitas)' : v.checkOutAt ? 'var(--m-dia)' : 'var(--m-rotas)',
      title: (
        <>
          Visita {v.user?.name ? <>de {v.user.name}</> : null}
          {!v.checkOutAt ? ' (em curso)' : v.isProductive ? ' — com encomenda' : ' — sem encomenda'}
        </>
      ),
      detail: (
        <span className="flex flex-wrap gap-1.5">
          {v.durationMins != null ? <Badge tone="neutral">{minutes(v.durationMins)}</Badge> : null}
          {v.withinGeofence ? (
            <Badge tone="ok" icon={MapPin}>
              No local
            </Badge>
          ) : (
            <Badge tone="warn" icon={MapPinOff}>
              Fora do local{v.distanceM != null ? ` (${Math.round(v.distanceM)} m)` : ''}
            </Badge>
          )}
          {v.noOrderReason ? <Badge tone="neutral">{v.noOrderReason}</Badge> : null}
        </span>
      ),
    }));
    const orders: TimelineEvent[] = outlet.orders.map((o) => ({
      id: `o-${o.id}`,
      at: o.createdAt,
      icon: ShoppingCart,
      color: 'var(--m-vendas)',
      title: (
        <>
          Encomenda {o.number} · {money(o.total)}
        </>
      ),
      detail: <OrderStatusBadge status={o.status} />,
    }));
    const payments: TimelineEvent[] = outlet.payments.map((p) => ({
      id: `p-${p.id}`,
      at: p.createdAt,
      icon: Banknote,
      color: 'var(--m-lojas)',
      title: (
        <>
          Cobrança de {money(p.amount)} · {PAYMENT_METHOD_LABEL[p.method]}
        </>
      ),
      detail: p.reference || p.notes ? <span className="text-xs text-ink-2">{[p.reference && `Ref. ${p.reference}`, p.notes].filter(Boolean).join(' · ')}</span> : null,
    }));
    return [...visits, ...orders, ...payments].sort((a, b) => b.at.localeCompare(a.at));
  }, [outlet]);

  if (!events.length)
    return <EmptyState illustration="store" title="Sem atividade ainda" description="As visitas, encomendas e cobranças desta loja aparecem aqui." compact />;

  return (
    <ol className="relative flex flex-col gap-4 pl-2">
      <span aria-hidden className="absolute top-2 bottom-2 left-[22px] w-px bg-line" />
      {events.map((e, i) => (
        <motion.li
          key={e.id}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 12) * 0.035, type: 'spring', stiffness: 320, damping: 28 }}
          className="relative flex gap-3"
        >
          <span
            className="relative z-10 inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border-2 border-surface"
            style={{ background: `color-mix(in oklab, ${e.color} 18%, var(--surface))`, color: e.color }}
          >
            <e.icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-semibold text-ink">{e.title}</p>
            <p className="text-xs text-ink-3">
              <time dateTime={e.at}>{dateTime(e.at)}</time> · {ago(e.at)}
            </p>
            {e.detail ? <div className="mt-1.5">{e.detail}</div> : null}
          </div>
        </motion.li>
      ))}
      <li className="pl-11 text-xs text-ink-3">Mostra as 10 visitas, encomendas e cobranças mais recentes de cada tipo.</li>
    </ol>
  );
}
