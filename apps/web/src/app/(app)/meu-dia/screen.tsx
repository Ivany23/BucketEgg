'use client';

import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, CircleDot, Map as MapIcon, Store, XCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { ActiveVisitBanner } from '@/components/field/active-visit';
import { longDay, shiftDay, useNow } from '@/components/field/geo';
import { useActiveVisit } from '@/components/field/shared';
import { taskColor } from '@/components/domain';
import { MapView, type MapPoint } from '@/components/map';
import { Button, ButtonLink, Card, EmptyState, ErrorState, Skeleton, cn } from '@/components/ui';
import { useProject } from '@/lib/project';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { MyDay, RouteDetail, Task, TaskStatus } from '@/lib/types';
import { AttendanceCard } from './attendance-card';
import { ProgressRing } from './progress-ring';
import { StopsTimeline, stopDomId } from './stops';
import { useToday } from '@/lib/today';

/** Paragens de rota pela ordem planeada; tarefas avulsas (sem rota) no fim. */
function orderStops(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!!a.routeId !== !!b.routeId) return a.routeId ? -1 : 1;
    if (a.routeId && b.routeId && a.routeId !== b.routeId) return a.routeId < b.routeId ? -1 : 1;
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return (a.estArrival ?? a.createdAt).localeCompare(b.estArrival ?? b.createdAt);
  });
}

const STATUS_CHIPS: { status: TaskStatus; label: string; icon: typeof CircleDot; color: string }[] = [
  { status: 'PENDING', label: 'Por visitar', icon: CircleDashed, color: 'var(--m-rotas)' },
  { status: 'IN_PROGRESS', label: 'Em curso', icon: CircleDot, color: 'var(--m-dia)' },
  { status: 'COMPLETED', label: 'Concluídas', icon: CheckCircle2, color: 'var(--ok)' },
  { status: 'MISSED', label: 'Falhadas', icon: XCircle, color: 'var(--bad)' },
];

export function MyDayScreen() {
  const { me, isManager } = useSession();
  const { project } = useProject();
  const today = useToday() ?? '';
  // Guarda só o dia escolhido; sem escolha, é hoje (calculado no browser, nunca na pré-renderização).
  const [picked, setDate] = useState<string | null>(null);
  const date = picked ?? today;
  const isToday = date === today;

  const q = useApi<MyDay>(['my-day', date], date ? '/routes/my-day' : null, { date });
  const active = useActiveVisit();
  const stops = useMemo(() => orderStops(q.data?.tasks ?? []), [q.data]);
  const routeId = stops.find((t) => t.routeId)?.routeId ?? null;
  const route = useApi<RouteDetail>(['routes', routeId], routeId ? `/routes/${routeId}` : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const select = (id: string) => {
    setSelectedId(id);
    document.getElementById(stopDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const points: MapPoint[] = stops.flatMap((t, i) =>
    t.outlet.latitude !== null && t.outlet.longitude !== null
      ? [{ id: t.id, lat: t.outlet.latitude, lng: t.outlet.longitude, label: `${i + 1}. ${t.outlet.name}`, number: i + 1, color: taskColor(t.status) }]
      : [],
  );
  const start = route.data?.startLat != null && route.data.startLng != null ? { lat: route.data.startLat, lng: route.data.startLng } : null;
  const counts = stops.reduce<Record<TaskStatus, number>>(
    (acc, t) => ({ ...acc, [t.status]: acc[t.status] + 1 }),
    { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, MISSED: 0, CANCELLED: 0 },
  );

  const firstName = (me?.name ?? me?.email ?? '').split(/[\s@]/)[0];

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho: saudação, navegação de datas e progresso */}
      <Card className="relative overflow-hidden p-5 sm:p-6">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-40 blur-3xl" style={{ background: 'var(--m-dia-soft)' }} />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--m-vendas-soft)' }} />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-[var(--accent-text)] uppercase">
              <CalendarCheck className="size-4" aria-hidden /> O meu dia
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">
              <Greeting />
              {firstName ? `, ${firstName}` : ''}!
            </h1>
            <p className="mt-1 text-sm text-ink-2 first-letter:uppercase">{longDay(date)}</p>
            <DateNav date={date} today={today} onChange={setDate} />
          </div>
          <div className="flex items-center gap-4 md:flex-col md:items-end lg:flex-row lg:items-center">
            {q.isPending ? (
              <Skeleton className="size-[132px] rounded-full" />
            ) : (
              <ProgressRing done={q.data?.completed ?? 0} total={q.data?.total ?? 0} />
            )}
            <ul className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 text-xs md:flex-none" aria-label="Paragens por estado">
              {STATUS_CHIPS.map((c) => (
                <li key={c.status} className="flex min-w-0 items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-1.5 font-semibold text-ink-2">
                  <c.icon className="size-3.5 shrink-0" style={{ color: c.color }} aria-hidden />
                  <span className="tabular-nums text-ink">{counts[c.status]}</span> <span className="truncate">{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {active.data ? <ActiveVisitBanner visit={active.data} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr]">
        <div className="lg:col-start-2 lg:row-start-1">
          {project && me ? <AttendanceCard projectId={project.id} projectName={project.name} meId={me.id} /> : null}
        </div>

        <section aria-labelledby="stops-title" className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="stops-title" className="text-lg font-bold text-ink">
              Paragens {stops.length ? <span className="text-ink-3">({stops.length})</span> : null}
            </h2>
            {!isToday && stops.length ? <span className="text-xs font-semibold text-ink-3">Só consulta: as ações ficam disponíveis no próprio dia.</span> : null}
          </div>
          {q.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="A carregar paragens">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-11 shrink-0 rounded-2xl" />
                  <Skeleton className="h-32 flex-1" />
                </div>
              ))}
            </div>
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={q.refetch} />
          ) : stops.length === 0 ? (
            <Card className="px-4">
              <EmptyState
                illustration="calendar"
                title={isToday ? 'Sem paragens para hoje' : date < today ? 'Não houve paragens neste dia' : 'Ainda sem paragens planeadas'}
                description={
                  isToday
                    ? 'Não tem rota nem tarefas atribuídas para hoje. Aproveite para visitar lojas em atraso ou fale com o seu supervisor.'
                    : 'Quando o supervisor planear a rota deste dia, as paragens aparecem aqui.'
                }
                action={
                  !isToday ? (
                    <Button variant="primary" onClick={() => setDate(today)}>
                      Voltar a hoje
                    </Button>
                  ) : isManager ? (
                    <ButtonLink href="/rotas" variant="primary" icon={MapIcon}>
                      Planear rotas
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/lojas" variant="primary" icon={Store}>
                      Ver lojas
                    </ButtonLink>
                  )
                }
              />
            </Card>
          ) : (
            <StopsTimeline tasks={stops} canAct={isToday} active={active.data} selectedId={selectedId} onSelect={select} />
          )}
        </section>

        {stops.length ? (
          <Card className="self-start overflow-hidden p-0 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-2">
            <div className="flex items-center gap-2 px-4 pt-4 pb-3">
              <MapIcon className="size-4 text-[var(--accent-text)]" aria-hidden />
              <h2 className="text-sm font-bold text-ink">Mapa do dia</h2>
              <span className="ml-auto text-xs text-ink-3">
                {points.length} de {stops.length} com GPS
              </span>
            </div>
            {points.length ? (
              <div className="px-2 pb-2">
                <MapView points={points} start={start} path height={320} selectedId={selectedId} onSelect={select} />
              </div>
            ) : (
              <p className="px-4 pb-4 text-sm text-ink-3">As lojas de hoje ainda não têm coordenadas GPS.</p>
            )}
            <MapLegend />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Greeting() {
  const now = useNow();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Maputo', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return <>{hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite'}</>;
}

function DateNav({ date, today, onChange }: { date: string; today: string; onChange: (d: string) => void }) {
  const reduce = useReducedMotion();
  const options = [
    { label: 'Ontem', value: shiftDay(today, -1) },
    { label: 'Hoje', value: today },
    { label: 'Amanhã', value: shiftDay(today, 1) },
  ];
  return (
    <div className="mt-4 flex items-center gap-1.5" role="group" aria-label="Escolher o dia">
      <button
        type="button"
        onClick={() => onChange(shiftDay(date, -1))}
        aria-label="Dia anterior"
        className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <div className="flex rounded-2xl bg-surface-2 p-1">
        {options.map((o) => {
          const active = o.value === date;
          return (
            <button
              key={o.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn('relative rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors sm:px-4', active ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
            >
              {active ? (
                <motion.span
                  layoutId="my-day-date"
                  className="shadow-soft absolute inset-0 rounded-xl bg-surface"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
                />
              ) : null}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftDay(date, 1))}
        aria-label="Dia seguinte"
        className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function MapLegend() {
  const items = [
    { label: 'Por visitar', color: 'var(--m-rotas)' },
    { label: 'Em curso', color: 'var(--m-dia)' },
    { label: 'Concluída', color: 'var(--ok)' },
    { label: 'Falhada', color: 'var(--bad)' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 text-[11px] font-semibold text-ink-3" aria-label="Legenda do mapa">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

