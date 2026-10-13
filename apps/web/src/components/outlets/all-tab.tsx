'use client';

import { FilterX, List, Map as MapIcon, Plus, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';
import { MapView, type MapPoint } from '@/components/map';
import { Badge, Button, EmptyState, ErrorState, Field, ListSkeleton, Pagination, SearchInput, Select, Skeleton, Tabs, cn } from '@/components/ui';
import { int } from '@/lib/format';
import { useApi } from '@/lib/query';
import { OUTLET_STATUS_LABEL, type Outlet, type OutletStatus, type Page } from '@/lib/types';
import { OutletCard, OutletGrid } from './outlet-card';
import { CLASS_LEGEND, STATUS_HEX, classStyle, hasCoords } from './meta';

type View = 'list' | 'map';
type ColorBy = 'status' | 'class';

interface Filters {
  search: string;
  zone: string;
  channel: string;
  outletClass: string;
  status: '' | OutletStatus;
}
const EMPTY: Filters = { search: '', zone: '', channel: '', outletClass: '', status: '' };
const PAGE_SIZE = 20;
const MAP_LIMIT = 500;

const uniq = (values: (string | null)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'pt'));

/** Valores existentes de zona, canal e classe (para os filtros e sugestões do formulário). */
export function useOutletFacets(projectId: string) {
  const q = useApi<Page<Outlet>>(['outlets', projectId, 'facets'], `/projects/${projectId}/outlets`, { limit: MAP_LIMIT }, { staleTime: 5 * 60_000 });
  return useMemo(() => {
    const rows = q.data?.data ?? [];
    return {
      zones: uniq(rows.map((o) => o.zone)),
      channels: uniq(rows.map((o) => o.channel)),
      classes: uniq(['A', 'B', 'C', ...rows.map((o) => o.outletClass)]),
    };
  }, [q.data]);
}

export function AllOutletsTab({
  projectId,
  onOpen,
  onCreate,
}: {
  projectId: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>('list');
  const [colorBy, setColorBy] = useState<ColorBy>('status');
  const [showFilters, setShowFilters] = useState(false);
  const facets = useOutletFacets(projectId);

  const set = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }, []);
  const onSearch = useCallback((v: string) => set('search', v), [set]);

  const query = { ...filters, status: filters.status || undefined };
  const list = useApi<Page<Outlet>>(
    ['outlets', projectId, 'list', page, filters],
    `/projects/${projectId}/outlets`,
    { ...query, page, limit: PAGE_SIZE },
    { placeholderData: (prev) => prev },
  );
  const map = useApi<Page<Outlet>>(
    ['outlets', projectId, 'map', filters],
    view === 'map' ? `/projects/${projectId}/outlets` : null,
    { ...query, limit: MAP_LIMIT },
  );

  const activeFilters = (['zone', 'channel', 'outletClass', 'status'] as const).filter((k) => filters[k]).length;
  const hasAny = activeFilters > 0 || !!filters.search;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={filters.search}
          onChange={onSearch}
          placeholder="Nome, código, morada ou telefone…"
          label="Pesquisar lojas"
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters || activeFilters ? 'soft' : 'secondary'}
            icon={SlidersHorizontal}
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            aria-controls="filtros-lojas"
          >
            Filtros
            {activeFilters ? (
              <span className="rounded-full bg-[var(--accent)] px-1.5 text-[11px] text-[#10141c] tabular-nums">{activeFilters}</span>
            ) : null}
          </Button>
          <Tabs<View>
            tabs={[
              { id: 'list', label: 'Lista', icon: List },
              { id: 'map', label: 'Mapa', icon: MapIcon },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showFilters ? (
          <motion.div
            id="filtros-lojas"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 rounded-2xl border border-line bg-surface-2/60 p-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
              <Field label="Zona">
                {(a) => (
                  <Select {...a} value={filters.zone} onChange={(e) => set('zone', e.target.value)}>
                    <option value="">Todas as zonas</option>
                    {facets.zones.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Canal">
                {(a) => (
                  <Select {...a} value={filters.channel} onChange={(e) => set('channel', e.target.value)}>
                    <option value="">Todos os canais</option>
                    {facets.channels.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Classe">
                {(a) => (
                  <Select {...a} value={filters.outletClass} onChange={(e) => set('outletClass', e.target.value)}>
                    <option value="">Todas as classes</option>
                    {facets.classes.map((c) => (
                      <option key={c} value={c}>
                        Classe {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Estado">
                {(a) => (
                  <Select {...a} value={filters.status} onChange={(e) => set('status', e.target.value as Filters['status'])}>
                    <option value="">Todos os estados</option>
                    {(Object.keys(OUTLET_STATUS_LABEL) as OutletStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {OUTLET_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button
                variant="ghost"
                icon={FilterX}
                disabled={!hasAny}
                onClick={() => {
                  setFilters(EMPTY);
                  setPage(1);
                }}
              >
                Limpar
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {view === 'list' ? (
        list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isPending ? (
          <ListSkeleton rows={6} />
        ) : list.data.data.length === 0 ? (
          <EmptyState
            illustration="store"
            title={hasAny ? 'Nenhuma loja corresponde aos filtros' : 'Ainda não há lojas'}
            description={
              hasAny
                ? 'Experimente outra pesquisa ou limpe os filtros.'
                : 'Registe as lojas (clientes) deste projeto para planear rotas, visitas e encomendas.'
            }
            action={
              hasAny ? (
                <Button
                  icon={FilterX}
                  onClick={() => {
                    setFilters(EMPTY);
                    setPage(1);
                  }}
                >
                  Limpar filtros
                </Button>
              ) : (
                <Button variant="primary" icon={Plus} onClick={onCreate}>
                  Nova loja
                </Button>
              )
            }
          />
        ) : (
          <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')} aria-busy={list.isFetching}>
            <OutletGrid>
              {list.data.data.map((o, i) => (
                <OutletCard key={o.id} outlet={o} index={i} onOpen={onOpen} />
              ))}
            </OutletGrid>
            <Pagination page={list.data.meta.page ?? page} pages={list.data.meta.pages ?? 1} total={list.data.meta.total} onChange={setPage} />
          </div>
        )
      ) : (
        <OutletsMap query={map} colorBy={colorBy} onColorBy={setColorBy} onOpen={onOpen} />
      )}
    </div>
  );
}

function OutletsMap({
  query,
  colorBy,
  onColorBy,
  onOpen,
}: {
  query: ReturnType<typeof useApi<Page<Outlet>>>;
  colorBy: ColorBy;
  onColorBy: (v: ColorBy) => void;
  onOpen: (id: string) => void;
}) {
  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const points = useMemo<MapPoint[]>(
    () =>
      rows.filter(hasCoords).map((o) => ({
        id: o.id,
        lat: o.latitude,
        lng: o.longitude,
        label: `${o.name}${o.zone ? ` — ${o.zone}` : ''}`,
        color: colorBy === 'status' ? STATUS_HEX[o.status] : classStyle(o.outletClass).hex,
      })),
    [rows, colorBy],
  );
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.isPending) return <Skeleton className="h-[460px] w-full rounded-2xl" />;
  const withoutGps = rows.length - points.length;
  const total = query.data.meta.total;
  const legend =
    colorBy === 'status'
      ? (Object.keys(STATUS_HEX) as OutletStatus[]).map((s) => ({ label: OUTLET_STATUS_LABEL[s], hex: STATUS_HEX[s] }))
      : CLASS_LEGEND.map((c) => ({ label: c.label, hex: c.hex }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span className="font-semibold">Cor por</span>
          <Tabs<ColorBy>
            tabs={[
              { id: 'status', label: 'Estado' },
              { id: 'class', label: 'Classe' },
            ]}
            value={colorBy}
            onChange={onColorBy}
          />
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legenda do mapa">
          {legend.map((l) => (
            <li key={l.label} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
              <span aria-hidden className="size-3 rounded-full border-2 border-surface shadow" style={{ background: l.hex }} />
              {l.label}
            </li>
          ))}
        </ul>
      </div>
      {points.length ? (
        <MapView points={points} circles height={460} onSelect={onOpen} />
      ) : (
        <EmptyState illustration="map" title="Nenhuma loja com GPS" description="As lojas encontradas ainda não têm coordenadas. Edite-as para as colocar no mapa." compact />
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="accent">{int(points.length)} no mapa</Badge>
        {withoutGps > 0 ? <Badge tone="warn">{int(withoutGps)} sem GPS</Badge> : null}
        {total > rows.length ? <Badge tone="info">A mostrar {int(rows.length)} de {int(total)} — refine os filtros</Badge> : null}
        <span className="text-ink-3">Toque num ponto para abrir a loja.</span>
      </div>
    </div>
  );
}
