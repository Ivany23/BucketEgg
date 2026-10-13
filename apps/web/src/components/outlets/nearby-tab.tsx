'use client';

import { Crosshair, LocateFixed, MapPinned, Navigation } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { MapView, type MapPoint } from '@/components/map';
import { Button, Card, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { useApi } from '@/lib/query';
import type { NearbyOutlet } from '@/lib/types';
import { OutletCard, OutletGrid } from './outlet-card';
import { DEMO_LOGIN, STATUS_HEX, directionsHref, distance, hasCoords, useGeolocation } from './meta';

const MIN_R = 500;
const MAX_R = 5000;

export function NearbyTab({ projectId, onOpen }: { projectId: string; onOpen: (id: string) => void }) {
  const geo = useGeolocation();
  const [radius, setRadius] = useState(1000);
  const [radiusQuery, setRadiusQuery] = useState(1000);
  const sliderId = useId();

  // Só pede à API quando o utilizador pára de arrastar o raio.
  useEffect(() => {
    if (radius === radiusQuery) return;
    const t = setTimeout(() => setRadiusQuery(radius), 350);
    return () => clearTimeout(t);
  }, [radius, radiusQuery]);

  const pos = geo.position;
  const q = useApi<NearbyOutlet[]>(
    ['outlets', projectId, 'nearby', pos?.lat, pos?.lng, radiusQuery],
    pos ? `/projects/${projectId}/outlets/nearby` : null,
    pos ? { lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6), radiusM: radiusQuery } : undefined,
    { placeholderData: (prev) => prev },
  );

  const rows = useMemo(() => q.data ?? [], [q.data]);
  const points = useMemo<MapPoint[]>(
    () =>
      rows.filter(hasCoords).map((o, i) => ({
        id: o.id,
        lat: o.latitude,
        lng: o.longitude,
        label: `${o.name} — ${distance(o.distanceM)}`,
        number: i + 1,
        color: STATUS_HEX[o.status],
      })),
    [rows],
  );

  if (!pos) {
    return (
      <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 p-6 text-center">
        <span
          className="inline-flex size-16 items-center justify-center rounded-3xl"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
        >
          <LocateFixed className="size-8" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Lojas perto de si</h2>
          <p className="mt-1 text-sm text-ink-2">
            Use o GPS do telemóvel para ver as lojas mais próximas, ordenadas pela distância. A localização só é usada nesta pesquisa.
          </p>
        </div>
        {geo.error ? (
          <p role="alert" className="w-full rounded-xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
            {geo.error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="accent" icon={Crosshair} loading={geo.loading} onClick={() => void geo.request()}>
            Usar a minha localização
          </Button>
          {DEMO_LOGIN ? (
            <Button variant="secondary" icon={MapPinned} onClick={geo.applyDemo}>
              Usar a Baixa de Maputo (demonstração)
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="shadow-soft flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex-1">
          <label htmlFor={sliderId} className="flex items-center justify-between text-sm font-semibold text-ink-2">
            Raio de pesquisa
            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[var(--accent-text)] tabular-nums">{distance(radius)}</span>
          </label>
          <input
            id={sliderId}
            type="range"
            min={MIN_R}
            max={MAX_R}
            step={250}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-valuetext={distance(radius)}
            className="mt-2 w-full accent-[var(--accent)]"
          />
          <div className="flex justify-between text-[11px] text-ink-3">
            <span>{distance(MIN_R)}</span>
            <span>{distance(MAX_R)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="soft" icon={Crosshair} loading={geo.loading} onClick={() => void geo.request()}>
            Atualizar posição
          </Button>
          {DEMO_LOGIN ? (
            <Button size="sm" variant="ghost" icon={MapPinned} onClick={geo.applyDemo}>
              Baixa (demo)
            </Button>
          ) : null}
        </div>
      </div>
      {geo.error ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
          {geo.error}
        </p>
      ) : null}

      <MapView points={points} start={pos} height={340} onSelect={onOpen} />

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          illustration="store"
          title={`Nenhuma loja num raio de ${distance(radiusQuery)}`}
          description="Aumente o raio de pesquisa ou registe uma loja nova neste local."
          compact
          action={
            radius < MAX_R ? (
              <Button variant="soft" onClick={() => setRadius(Math.min(MAX_R, radius * 2))}>
                Alargar para {distance(Math.min(MAX_R, radius * 2))}
              </Button>
            ) : null
          }
        />
      ) : (
        <OutletGrid className={q.isPlaceholderData ? 'opacity-60' : undefined}>
          {rows.map((o, i) => (
            <OutletCard
              key={o.id}
              outlet={o}
              index={i}
              onOpen={onOpen}
              aside={
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-extrabold text-[var(--accent-text)] tabular-nums">
                    {distance(o.distanceM)}
                  </span>
                  <span className="text-[11px] font-bold text-ink-3">#{i + 1}</span>
                </span>
              }
              footer={
                hasCoords(o) ? (
                  <a
                    href={directionsHref(o.latitude, o.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-text)] hover:underline"
                  >
                    <Navigation className="size-4" aria-hidden />
                    Navegar até lá
                  </a>
                ) : null
              }
            />
          ))}
        </OutletGrid>
      )}
    </div>
  );
}
