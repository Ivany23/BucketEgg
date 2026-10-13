'use client';

import { CalendarClock, CheckCircle2, Clock, LogIn, LogOut, MapPinOff, Milestone, Settings2, Timer, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { TaskStatusBadge, taskColor } from '@/components/domain';
import { MapView, type MapPoint } from '@/components/map';
import { Avatar, Button, Drawer, ErrorState, Input, ProgressBar, Select, Skeleton, cn, useConfirm, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { date, km, minutes, time } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import { TASK_STATUS_LABEL, type RouteDetail, type Task, type TaskStatus } from '@/lib/types';
import { MiniStat, OptimizerBadge } from './shared';
import { addDays, useToday } from '@/lib/today';

interface UpdateTaskBody {
  status?: TaskStatus;
  dueDate?: string;
}

const STATUSES = Object.keys(TASK_STATUS_LABEL) as TaskStatus[];

/** Painel de detalhe de uma rota: mapa, paragens ordenadas e ações do gestor. */
export function RouteDrawer({ routeId, onClose }: { routeId: string | null; onClose: () => void }) {
  const q = useApi<RouteDetail>(['route', routeId], routeId ? `/routes/${routeId}` : null);
  const route = q.data;
  const { isManager } = useSession();
  const confirm = useConfirm();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);

  const del = useApiMutation((id: string) => api<{ deleted: boolean }>(`/routes/${id}`, { method: 'DELETE' }), {
    invalidate: [['routes'], ['beats'], ['beat'], ['my-day'], ['dashboard']],
    onSuccess: () => {
      toast.success('Rota apagada', 'As paragens por visitar foram removidas.');
      onClose();
    },
    onError: (e) => toast.error('Não foi possível apagar a rota', e.message),
  });

  const askDelete = async () => {
    if (!route) return;
    const done = route.tasks.filter((t) => t.status !== 'PENDING').length;
    const ok = await confirm({
      title: `Apagar “${route.name}”?`,
      description: (
        <>
          As paragens <strong>por visitar</strong> são removidas.{' '}
          {done
            ? `As ${done} paragens já trabalhadas (concluídas, em curso, falhadas ou canceladas) ficam guardadas no histórico, sem rota.`
            : 'Nenhuma paragem foi ainda trabalhada.'}
        </>
      ),
      confirmLabel: 'Apagar rota',
      danger: true,
    });
    if (ok) del.mutate(route.id);
  };

  const points: MapPoint[] = (route?.tasks ?? [])
    .filter((t) => t.outlet.latitude != null && t.outlet.longitude != null)
    .map((t) => ({
      id: t.id,
      lat: t.outlet.latitude as number,
      lng: t.outlet.longitude as number,
      label: `${t.orderIndex}. ${t.outlet.name} — ${TASK_STATUS_LABEL[t.status]}`,
      number: t.orderIndex,
      color: taskColor(t.status),
    }));
  const start = route && route.startLat != null && route.startLng != null ? { lat: route.startLat, lng: route.startLng } : null;
  const completed = route?.tasks.filter((t) => t.status === 'COMPLETED').length ?? 0;

  return (
    <Drawer
      open={!!routeId}
      onClose={onClose}
      width="xl"
      module="rotas"
      title={route?.name ?? 'Rota'}
      subtitle={
        route ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={route.assignee.name} email={route.assignee.email} size={22} />
              {route.assignee.name ?? route.assignee.email}
            </span>
            <span aria-hidden>·</span>
            <span>
              {date(route.date)} às {time(route.date)}
            </span>
            <OptimizerBadge by={route.optimizedBy} />
          </span>
        ) : null
      }
      footer={
        isManager && route ? (
          <Button variant="danger" icon={Trash2} loading={del.isPending} onClick={() => void askDelete()}>
            Apagar rota
          </Button>
        ) : undefined
      }
    >
      {q.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="A carregar a rota">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
          <Skeleton className="h-80" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : route ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat icon={Milestone} label="Paragens" value={route.tasks.length} color="var(--m-rotas)" />
            <MiniStat icon={CheckCircle2} label="Concluídas" value={`${completed}/${route.tasks.length}`} color="var(--m-visitas)" />
            <MiniStat icon={Timer} label="Distância" value={km(route.totalDistance)} color="var(--m-beats)" />
            <MiniStat icon={Clock} label="Tempo estimado" value={minutes(route.estimatedMins)} color="var(--m-dia)" />
          </div>
          <ProgressBar value={completed} max={route.tasks.length || 1} tone="ok" label="Progresso da rota" />

          {points.length ? (
            <MapView points={points} start={start} path height={340} selectedId={selected} onSelect={setSelected} />
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-line p-4 text-sm text-ink-3">
              <MapPinOff className="size-4" aria-hidden /> Nenhuma paragem tem coordenadas GPS para mostrar no mapa.
            </div>
          )}

          <section aria-labelledby="stops-title">
            <h3 id="stops-title" className="mb-3 text-sm font-bold text-ink">
              Paragens por ordem de visita
            </h3>
            {route.tasks.length ? (
              <ol className="flex flex-col gap-2">
                {route.tasks.map((t, i) => (
                  <StopRow key={t.id} task={t} index={i} routeId={route.id} selected={selected === t.id} onSelect={() => setSelected(t.id)} canManage={isManager} />
                ))}
              </ol>
            ) : (
              <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-3">Esta rota não tem paragens.</p>
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

function StopRow({
  task: t,
  index,
  routeId,
  selected,
  onSelect,
  canManage,
}: {
  task: Task;
  index: number;
  routeId: string;
  selected: boolean;
  onSelect: () => void;
  canManage: boolean;
}) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const today = useToday();
  // Por omissão reagenda para amanhã (calculado no browser).
  const [pickedDay, setDay] = useState<string>();
  const day = pickedDay ?? (today ? addDays(today, 1) : '');
  const visit = t.visits[0];
  const panelId = `stop-actions-${t.id}`;

  const update = useApiMutation((body: UpdateTaskBody) => api<Task>(`/tasks/${t.id}`, { method: 'PATCH', body }), {
    invalidate: [['route', routeId], ['routes'], ['my-day'], ['dashboard']],
    onSuccess: (_, body) =>
      body.dueDate
        ? toast.success('Paragem reagendada', `${t.outlet.name} passa para ${date(`${body.dueDate}T12:00:00Z`)}.`)
        : toast.success('Estado atualizado', `${t.outlet.name}: ${TASK_STATUS_LABEL[body.status as TaskStatus]}.`),
    onError: (e) => toast.error('Não foi possível atualizar a paragem', e.message),
  });

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.035, type: 'spring', stiffness: 280, damping: 26 }}
      className={cn(
        'rounded-2xl border bg-surface transition-[border-color,box-shadow]',
        selected ? 'border-[var(--accent)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_20%,transparent)]' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Mostrar ${t.outlet.name} no mapa`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-[#10141c] transition-transform hover:scale-105"
          style={{ background: `color-mix(in oklab, ${taskColor(t.status)} 75%, white)` }}
        >
          {t.orderIndex}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold text-ink">{t.outlet.name}</span>
            <TaskStatusBadge status={t.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-3">{t.outlet.address ?? t.outlet.zone ?? 'Sem morada'}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5 text-[var(--m-rotas)]" aria-hidden />
              Chegada prevista <strong className="font-semibold text-ink">{time(t.estArrival)}</strong>
            </span>
            {visit ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <LogIn className="size-3.5 text-[var(--m-visitas)]" aria-hidden />
                  Entrada <strong className="font-semibold text-ink">{time(visit.checkInAt)}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <LogOut className="size-3.5 text-[var(--m-vendas)]" aria-hidden />
                  Saída <strong className="font-semibold text-ink">{visit.checkOutAt ? time(visit.checkOutAt) : 'em curso'}</strong>
                </span>
              </>
            ) : null}
            {t.outlet.latitude == null ? (
              <span className="inline-flex items-center gap-1 text-warn">
                <MapPinOff className="size-3.5" aria-hidden /> Sem GPS
              </span>
            ) : null}
          </div>
          {t.title || t.notes ? <p className="mt-1.5 text-xs text-ink-2">{[t.title, t.notes].filter(Boolean).join(' — ')}</p> : null}
        </div>
        {canManage ? (
          <Button size="sm" variant={open ? 'soft' : 'ghost'} icon={Settings2} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
            <span className="hidden sm:inline">Gerir</span>
            <span className="sr-only sm:hidden">Gerir paragem</span>
          </Button>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {canManage && open ? (
          <motion.div
            id={panelId}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink-2">Estado</span>
                <Select
                  value={t.status}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ status: e.target.value as TaskStatus })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </label>
              <form
                className="flex flex-col gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (day) update.mutate({ dueDate: day });
                }}
              >
                <label htmlFor={`${panelId}-day`} className="text-[13px] font-semibold text-ink-2">
                  Reagendar para
                </label>
                <div className="flex gap-2">
                  <Input id={`${panelId}-day`} type="date" required value={day} min={today ?? undefined} onChange={(e) => setDay(e.target.value)} />
                  <Button type="submit" variant="secondary" icon={CalendarClock} loading={update.isPending && !!update.variables?.dueDate}>
                    Reagendar
                  </Button>
                </div>
              </form>
              <p className="text-xs text-ink-3 sm:col-span-2">A paragem reagendada aparece no “O meu dia” do promotor na nova data.</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.li>
  );
}
