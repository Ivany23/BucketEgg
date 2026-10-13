'use client';

import { CalendarRange, MapPinOff, Pencil, Route as RouteIcon, Store, Trash2, Wand2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { OutletStatusBadge } from '@/components/domain';
import { MapView, type MapPoint } from '@/components/map';
import { Avatar, Button, Drawer, ErrorState, Skeleton, useConfirm, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi, useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { BeatDetail } from '@/lib/types';
import { GenerateBeatRoute } from './generate-route';
import { MiniStat, STEP_COLORS, WeekdayChips } from './shared';

/** Detalhe de um beat: lojas por ordem, mapa e (gestores) gerar rota, editar, apagar. */
export function BeatDrawer({
  beatId,
  routesCount,
  onClose,
  onEdit,
}: {
  beatId: string | null;
  /** Nº de rotas geradas (vem da lista; o detalhe não o inclui). */
  routesCount?: number;
  onClose: () => void;
  onEdit: (beat: BeatDetail) => void;
}) {
  const q = useApi<BeatDetail>(['beat', beatId], beatId ? `/beats/${beatId}` : null);
  const beat = q.data;
  const { isManager } = useSession();
  const confirm = useConfirm();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);

  const del = useApiMutation((id: string) => api<{ deleted: boolean }>(`/beats/${id}`, { method: 'DELETE' }), {
    invalidate: [['beats'], ['routes']],
    onSuccess: () => {
      toast.success('Beat apagado');
      onClose();
    },
    onError: (e) => toast.error('Não foi possível apagar o beat', e.message),
  });

  const askDelete = async () => {
    if (!beat) return;
    const ok = await confirm({
      title: `Apagar “${beat.name}”?`,
      description: 'O circuito e a sua lista de lojas deixam de existir. As rotas já geradas a partir dele mantêm-se.',
      confirmLabel: 'Apagar beat',
      danger: true,
    });
    if (ok) del.mutate(beat.id);
  };

  const points: MapPoint[] = (beat?.outlets ?? [])
    .filter((b) => b.outlet.latitude != null && b.outlet.longitude != null)
    .map((b) => ({
      id: b.outletId,
      lat: b.outlet.latitude as number,
      lng: b.outlet.longitude as number,
      label: `${b.orderIndex + 1}. ${b.outlet.name}`,
      number: b.orderIndex + 1,
      color: 'var(--m-beats)',
    }));

  return (
    <Drawer
      open={!!beatId}
      onClose={onClose}
      width="xl"
      module="beats"
      title={beat?.name ?? 'Beat'}
      subtitle={beat?.description ?? (beat ? 'Circuito semanal' : null)}
      footer={
        isManager && beat ? (
          <>
            <Button variant="danger" icon={Trash2} loading={del.isPending} onClick={() => void askDelete()}>
              Apagar
            </Button>
            <Button variant="secondary" icon={Pencil} onClick={() => onEdit(beat)}>
              Editar
            </Button>
          </>
        ) : undefined
      }
    >
      {q.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="A carregar o beat">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-80" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : beat ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WeekdayChips days={beat.weekdays} />
            <span className="inline-flex items-center gap-2 text-sm text-ink-2">
              {beat.assignee ? (
                <>
                  <Avatar name={beat.assignee.name} email={beat.assignee.email} size={26} />
                  {beat.assignee.name ?? beat.assignee.email}
                </>
              ) : (
                <span className="font-medium text-warn">Sem promotor atribuído</span>
              )}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon={Store} label="Lojas" value={beat.outlets.length} color="var(--m-lojas)" />
            <MiniStat icon={CalendarRange} label="Dias por semana" value={beat.weekdays.length} color="var(--m-beats)" />
            <MiniStat icon={RouteIcon} label="Rotas geradas" value={routesCount ?? '—'} color="var(--m-rotas)" />
          </div>

          {points.length ? (
            <MapView points={points} path height={320} selectedId={selected} onSelect={setSelected} />
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-line p-4 text-sm text-ink-3">
              <MapPinOff className="size-4" aria-hidden /> Nenhuma loja deste beat tem coordenadas GPS.
            </div>
          )}

          <section aria-labelledby="beat-outlets-title">
            <h3 id="beat-outlets-title" className="mb-3 text-sm font-bold text-ink">
              Lojas pela ordem do circuito
            </h3>
            {beat.outlets.length ? (
              <ol className="flex flex-col gap-2">
                {beat.outlets.map((b, i) => {
                  const color = STEP_COLORS[i % STEP_COLORS.length];
                  return (
                    <motion.li
                      key={b.outletId}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 12) * 0.03, type: 'spring', stiffness: 280, damping: 26 }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected(b.outletId)}
                        aria-current={selected === b.outletId ? 'true' : undefined}
                        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition-colors hover:bg-surface-2 aria-[current=true]:border-[var(--accent)]"
                      >
                        <span
                          aria-hidden
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
                          style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
                        >
                          {b.orderIndex + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-ink">{b.outlet.name}</span>
                          <span className="block truncate text-xs text-ink-3">
                            {[b.outlet.code, b.outlet.address ?? b.outlet.zone, b.outlet.channel].filter(Boolean).join(' · ') || 'Sem morada'}
                          </span>
                        </span>
                        {b.outlet.status !== 'ACTIVE' ? <OutletStatusBadge status={b.outlet.status} /> : null}
                        {b.outlet.latitude == null ? <MapPinOff className="size-4 shrink-0 text-warn" aria-label="Sem GPS" /> : null}
                      </button>
                    </motion.li>
                  );
                })}
              </ol>
            ) : (
              <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-3">Este beat ainda não tem lojas.</p>
            )}
          </section>

          {isManager ? (
            <section aria-labelledby="beat-generate-title" className="rounded-2xl border border-line bg-surface-2/50 p-4">
              <h3 id="beat-generate-title" className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
                <Wand2 className="size-4 text-[var(--accent-text)]" aria-hidden />
                Gerar rota para um dia
              </h3>
              <p className="mb-4 text-xs text-ink-3">Cria a rota otimizada com as lojas ativas deste beat, atribuída ao seu promotor.</p>
              <GenerateBeatRoute key={beat.id} beat={beat} />
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
