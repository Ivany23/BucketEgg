'use client';

import { Clock, MapPinOff, MapPinned, ShoppingCart, Store, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useRef, useState } from 'react';
import { GeofenceBadge, ProductiveBadge } from '@/components/field/shared';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  ListSkeleton,
  Pagination,
  Select,
  Skeleton,
  StatTile,
  Table,
  type Column,
} from '@/components/ui';
import { dateTime, int, minutes, todayIso } from '@/lib/format';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Member, Outlet, Page, Visit } from '@/lib/types';
import { VisitDrawer } from './visit-drawer';

const STATS_LIMIT = 500;

function summarize(rows: Visit[]) {
  const closed = rows.filter((v) => v.checkOutAt);
  const durations = closed.map((v) => v.durationMins ?? 0);
  return {
    productivePct: closed.length ? (closed.filter((v) => v.isProductive).length / closed.length) * 100 : 0,
    outside: rows.filter((v) => !v.withinGeofence).length,
    avgDuration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
  };
}

export function VisitsTab({ projectId }: { projectId: string }) {
  const { isManager, isFieldRep } = useSession();
  const [from, setFrom] = useState(() => todayIso(-6));
  const [to, setTo] = useState(() => todayIso());
  const [userId, setUserId] = useState('');
  const [outlet, setOutlet] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Visit | null>(null);

  const rangeError = from && to && from > to ? 'A data inicial tem de ser anterior à final.' : null;
  const filters = { from, to, userId: userId || undefined, outletId: outlet?.id };
  const path = rangeError ? null : `/projects/${projectId}/visits`;

  const q = useApi<Page<Visit>>(['visits', projectId, 'list', page, filters], path, { ...filters, page, limit: 20 });
  const stats = useApi<Page<Visit>>(['visits', projectId, 'stats', filters], path, { ...filters, page: 1, limit: STATS_LIMIT });
  const team = useApi<Member[]>(['team'], isManager ? '/team' : null);
  const reps = (team.data ?? []).filter((m) => m.role === 'FIELD_REP' && m.isActive);

  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const s = stats.data ? summarize(stats.data.data) : null;
  const total = stats.data?.meta.total ?? q.data?.meta.total ?? 0;
  const partial = (stats.data?.meta.total ?? 0) > STATS_LIMIT;

  const columns: Column<Visit>[] = [
    {
      key: 'loja',
      header: 'Loja',
      cell: (v) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{v.outlet?.name ?? '—'}</p>
          {v.outlet?.zone ? <p className="text-xs text-ink-3">{v.outlet.zone}</p> : null}
        </div>
      ),
    },
    ...(isFieldRep
      ? []
      : [
          {
            key: 'promotor',
            header: 'Promotor',
            cell: (v: Visit) => (
              <span className="flex items-center gap-2">
                <Avatar name={v.user?.name} email={v.user?.email} size={28} />
                <span className="truncate">{v.user?.name ?? v.user?.email ?? '—'}</span>
              </span>
            ),
          },
        ]),
    { key: 'checkin', header: 'Check-in', cell: (v) => <span className="whitespace-nowrap tabular-nums">{dateTime(v.checkInAt)}</span> },
    {
      key: 'duracao',
      header: 'Duração',
      align: 'right',
      cell: (v) =>
        v.checkOutAt ? (
          minutes(v.durationMins)
        ) : (
          <Badge tone="info" icon={Clock}>
            Em curso
          </Badge>
        ),
    },
    { key: 'geo', header: 'Geofence', cell: (v) => <GeofenceBadge within={v.withinGeofence} distanceM={v.distanceM} /> },
    { key: 'prod', header: 'Produtiva', cell: (v) => <ProductiveBadge productive={v.isProductive} open={!v.checkOutAt} /> },
    { key: 'enc', header: 'Encomendas', align: 'right', hideOnMobile: true, cell: (v) => int(v._count?.orders) },
    {
      key: 'motivo',
      header: 'Motivo sem encomenda',
      hideOnMobile: true,
      cell: (v) => <span className="line-clamp-2 max-w-48 text-xs text-ink-2">{v.noOrderReason ?? '—'}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="De" error={rangeError}>
            {(a) => <Input {...a} type="date" value={from} max={to || undefined} onChange={(e) => change(setFrom)(e.target.value)} />}
          </Field>
          <Field label="Até">
            {(a) => <Input {...a} type="date" value={to} min={from || undefined} onChange={(e) => change(setTo)(e.target.value)} />}
          </Field>
          {isManager ? (
            <Field label="Promotor">
              {(a) => (
                <Select {...a} value={userId} onChange={(e) => change(setUserId)(e.target.value)} disabled={team.isPending}>
                  <option value="">Todos os promotores</option>
                  {reps.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name ?? m.user.email}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <OutletPicker projectId={projectId} value={outlet} onChange={change(setOutlet)} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.isPending && !rangeError ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatTile index={0} label="Visitas" value={total} icon={MapPinned} color="var(--m-visitas)" hint="no período escolhido" />
            <StatTile
              index={1}
              label="Produtivas"
              value={s?.productivePct ?? 0}
              format={(v) => `${Math.round(v)}%`}
              icon={ShoppingCart}
              color="var(--m-vendas)"
              hint="visitas terminadas com encomenda"
            />
            <StatTile index={2} label="Fora do geofence" value={s?.outside ?? 0} icon={MapPinOff} color="var(--bad)" hint="check-in longe da loja" />
            <StatTile
              index={3}
              label="Duração média"
              value={s?.avgDuration ?? 0}
              format={(v) => minutes(v)}
              icon={Clock}
              color="var(--m-rotas)"
              hint={partial ? `com base nas ${STATS_LIMIT} mais recentes` : 'por visita terminada'}
            />
          </>
        )}
      </div>

      {rangeError ? null : q.isPending ? (
        <ListSkeleton rows={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : q.data.data.length === 0 ? (
        <Card className="px-4">
          <EmptyState
            illustration="map"
            title="Sem visitas neste período"
            description="Experimente alargar as datas ou limpar os filtros. As visitas aparecem aqui depois de cada check-in."
          />
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Table
              columns={columns}
              rows={q.data.data}
              rowKey={(v) => v.id}
              onRowClick={setSelected}
              rowLabel={(v) => `Ver visita a ${v.outlet?.name ?? 'loja'} em ${dateTime(v.checkInAt)}`}
            />
          </div>
          <MobileVisitList rows={q.data.data} showUser={!isFieldRep} onOpen={setSelected} />
          <Pagination page={page} pages={q.data.meta.pages ?? 1} total={q.data.meta.total} onChange={setPage} />
        </>
      )}

      <VisitDrawer visit={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function MobileVisitList({ rows, showUser, onOpen }: { rows: Visit[]; showUser: boolean; onOpen: (v: Visit) => void }) {
  const reduce = useReducedMotion();
  return (
    <ul className="flex flex-col gap-2.5 md:hidden">
      {rows.map((v, i) => (
        <motion.li
          key={v.id}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 10) * 0.035, type: 'spring', stiffness: 280, damping: 26 }}
        >
          <button
            type="button"
            onClick={() => onOpen(v)}
            className="shadow-soft w-full rounded-2xl border border-line bg-surface p-4 text-left transition-shadow hover:shadow-lift"
          >
            <div className="flex items-start gap-3">
              <span
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: 'var(--m-lojas-soft)', color: 'var(--m-lojas-text)' }}
              >
                <Store className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{v.outlet?.name ?? '—'}</p>
                <p className="text-xs text-ink-3">
                  {dateTime(v.checkInAt)} · {v.checkOutAt ? minutes(v.durationMins) : 'em curso'}
                  {v.outlet?.zone ? ` · ${v.outlet.zone}` : ''}
                </p>
              </div>
            </div>
            {showUser ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                <Avatar name={v.user?.name} email={v.user?.email} size={22} />
                {v.user?.name ?? v.user?.email}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <GeofenceBadge within={v.withinGeofence} distanceM={v.distanceM} />
              <ProductiveBadge productive={v.isProductive} open={!v.checkOutAt} />
              {v._count?.orders ? <Badge tone="accent">{v._count.orders} enc.</Badge> : null}
            </div>
            {v.noOrderReason ? <p className="mt-2 text-xs text-ink-2">Motivo: {v.noOrderReason}</p> : null}
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

/** Filtro opcional por loja: pesquisa no projeto e escolhe uma. */
function OutletPicker({ projectId, value, onChange }: { projectId: string; value: { id: string; name: string } | null; onChange: (v: { id: string; name: string } | null) => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  // Espera 300 ms depois de escrever antes de pesquisar.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = useApi<Page<Outlet>>(['outlets', projectId, 'pick', term], term ? `/projects/${projectId}/outlets` : null, { search: term, limit: 8 });

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">Loja</span>
        <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] pr-1 pl-3 text-sm font-semibold text-ink">
          <Store className="size-4 shrink-0 text-[var(--accent-text)]" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{value.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remover filtro da loja ${value.name}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </span>
      </div>
    );
  }

  const results = q.data?.data ?? [];
  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
        Loja <span className="font-normal text-ink-3">(opcional)</span>
      </label>
      <Input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={open && !!term}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        placeholder="Pesquisar loja…"
        value={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setOpen(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setTerm(v.trim()), 300);
        }}
      />
      {open && term ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="shadow-lift absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1"
        >
          {q.isPending ? (
            <li className="px-3 py-2 text-sm text-ink-3">A pesquisar…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-3">Nenhuma loja encontrada.</li>
          ) : (
            results.map((o) => (
              <li key={o.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ id: o.id, name: o.name });
                    setText('');
                    setTerm('');
                    setOpen(false);
                  }}
                  className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <span className="truncate text-sm font-semibold text-ink">{o.name}</span>
                  <span className="truncate text-xs text-ink-3">{[o.code, o.zone].filter(Boolean).join(' · ') || ' '}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

