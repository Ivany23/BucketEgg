'use client';

import { Clock, LogIn, LogOut, MapPin, Ruler, ShoppingCart, StickyNote, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { meters } from '@/components/field/geo';
import { GeofenceBadge, ProductiveBadge } from '@/components/field/shared';
import { MapView, type MapPoint } from '@/components/map';
import { Avatar, Drawer, Skeleton } from '@/components/ui';
import { dateTime, int, minutes, time } from '@/lib/format';
import { useApi } from '@/lib/query';
import type { Outlet, Visit } from '@/lib/types';

/** Detalhe de uma visita: tempos, geofence, motivo e mapa (loja vs ponto de check-in). */
export function VisitDrawer({ visit, onClose }: { visit: Visit | null; onClose: () => void }) {
  const outlet = useApi<Outlet>(['outlets', 'detail', visit?.outletId], visit ? `/outlets/${visit.outletId}` : null);
  const o = outlet.data;

  const points: MapPoint[] = [];
  if (o?.latitude != null && o.longitude != null) points.push({ id: 'loja', lat: o.latitude, lng: o.longitude, label: `Loja: ${o.name}`, color: 'var(--m-lojas)' });
  if (visit?.checkInLat != null && visit.checkInLng != null)
    points.push({
      id: 'checkin',
      lat: visit.checkInLat,
      lng: visit.checkInLng,
      label: `Check-in ${time(visit.checkInAt)}${visit.distanceM !== null ? ` · a ${meters(visit.distanceM)} da loja` : ''}`,
      number: 1,
      color: visit.withinGeofence ? 'var(--ok)' : 'var(--bad)',
    });
  if (visit?.checkOutLat != null && visit.checkOutLng != null)
    points.push({ id: 'checkout', lat: visit.checkOutLat, lng: visit.checkOutLng, label: `Check-out ${time(visit.checkOutAt)}`, number: 2, color: 'var(--m-rotas)' });

  return (
    <Drawer
      open={!!visit}
      onClose={onClose}
      module="visitas"
      width="lg"
      title={visit?.outlet?.name ?? 'Visita'}
      subtitle={visit ? `${dateTime(visit.checkInAt)}${visit.outlet?.zone ? ` · ${visit.outlet.zone}` : ''}` : undefined}
    >
      {visit ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <GeofenceBadge within={visit.withinGeofence} distanceM={visit.distanceM} />
            <ProductiveBadge productive={visit.isProductive} open={!visit.checkOutAt} />
          </div>

          <dl className="grid grid-cols-2 gap-2.5">
            <Info icon={UserRound} color="var(--m-equipa)" label="Promotor">
              <span className="flex items-center gap-2">
                <Avatar name={visit.user?.name} email={visit.user?.email} size={22} />
                <span className="truncate">{visit.user?.name ?? visit.user?.email ?? '—'}</span>
              </span>
            </Info>
            <Info icon={Clock} color="var(--m-rotas)" label="Duração">
              {visit.checkOutAt ? minutes(visit.durationMins) : 'Em curso'}
            </Info>
            <Info icon={LogIn} color="var(--m-visitas)" label="Check-in">
              {time(visit.checkInAt)}
            </Info>
            <Info icon={LogOut} color="var(--m-dia)" label="Check-out">
              {visit.checkOutAt ? time(visit.checkOutAt) : '—'}
            </Info>
            <Info icon={Ruler} color={visit.withinGeofence ? 'var(--ok)' : 'var(--bad)'} label="Distância à loja">
              {visit.distanceM !== null ? meters(visit.distanceM) : 'Loja sem GPS'}
            </Info>
            <Info icon={ShoppingCart} color="var(--m-vendas)" label="Encomendas">
              {int(visit._count?.orders)}
            </Info>
          </dl>

          {visit.noOrderReason ? (
            <div className="rounded-2xl bg-warn-soft px-4 py-3 text-sm">
              <p className="font-bold text-warn">Motivo sem encomenda</p>
              <p className="mt-0.5 text-ink-2">{visit.noOrderReason}</p>
            </div>
          ) : null}
          {visit.notes ? (
            <div className="flex gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
              <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="whitespace-pre-line">{visit.notes}</p>
            </div>
          ) : null}

          <section aria-labelledby="visit-map">
            <h3 id="visit-map" className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
              <MapPin className="size-4 text-[var(--accent-text)]" aria-hidden /> Loja e ponto de check-in
            </h3>
            {outlet.isPending ? (
              <Skeleton className="h-72" />
            ) : points.length ? (
              <>
                <MapView points={points} height={300} />
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-3" aria-label="Legenda do mapa">
                  <Legend color="var(--m-lojas)">Loja</Legend>
                  <Legend color={visit.withinGeofence ? 'var(--ok)' : 'var(--bad)'}>1 · Check-in</Legend>
                  {visit.checkOutLat != null ? <Legend color="var(--m-rotas)">2 · Check-out</Legend> : null}
                </ul>
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">Sem coordenadas para mostrar no mapa.</p>
            )}
            {o?.address ? <p className="mt-2 text-xs text-ink-3">{o.address}</p> : null}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

function Info({ icon: Icon, color, label, children }: { icon: typeof Clock; color: string; label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-3">
        <Icon className="size-3.5" style={{ color }} aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold text-ink tabular-nums">{children}</dd>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
      {children}
    </li>
  );
}
