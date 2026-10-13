'use client';

import { CalendarDays, CheckCircle2, ClipboardPlus, Clock, Gauge, Milestone, Route as RouteIcon, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState, useSyncExternalStore } from 'react';
import { RequireProject } from '@/components/domain';
import { PlanRouteModal } from '@/components/planning/plan-route-modal';
import { RouteDrawer } from '@/components/planning/route-drawer';
import { OptimizerBadge, memberLabel, useTeam } from '@/components/planning/shared';
import { TaskModal } from '@/components/planning/task-modal';
import { Avatar, Button, Card, EmptyState, ErrorState, Input, PageHeader, ProgressBar, Select, Skeleton, StatTile, cn } from '@/components/ui';
import { date, km, minutes, time } from '@/lib/format';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Project, RouteSummary } from '@/lib/types';
import { addDays, useToday } from '@/lib/today';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/** Ligações vindas de outros ecrãs: /rotas?dia=AAAA-MM-DD&rota=<id>. */
function parseLink(search: string): { day: string | null; route: string | null } {
  const p = new URLSearchParams(search);
  const day = p.get('dia');
  const route = p.get('rota');
  return { day: day && ISO_DAY.test(day) ? day : null, route: route && UUID.test(route) ? route : null };
}
const noopSubscribe = () => () => undefined;
// No servidor não há URL do browser: '' (sem ligação). No cliente lê-se uma vez, sem divergência na hidratação.
const useLocationSearch = () => useSyncExternalStore(noopSubscribe, () => window.location.search, () => '');

const weekday = (day: string) => (day ? new Date(`${day}T12:00:00Z`).toLocaleDateString('pt-PT', { weekday: 'long', timeZone: 'UTC' }) : '');

export function RoutesScreen() {
  const { isManager } = useSession();
  const link = parseLink(useLocationSearch());
  // undefined = o utilizador ainda não escolheu: vale o que vem na ligação (ou hoje).
  const [pickedDay, setDay] = useState<string>();
  const today = useToday();
  const day = pickedDay ?? link.day ?? today ?? '';
  const [assigneeId, setAssigneeId] = useState('');
  const [pickedRoute, setOpenRoute] = useState<string | null>();
  const openRoute = pickedRoute === undefined ? link.route : pickedRoute;
  const [planning, setPlanning] = useState(false);
  const [tasking, setTasking] = useState(false);

  return (
    <RequireProject>
      {(project) => (
        <>
          <PageHeader
            icon={RouteIcon}
            eyebrow="Planeamento"
            title="Rotas"
            description={
              isManager
                ? 'Planeie o dia de cada promotor: a ordem das visitas é otimizada e cada paragem tem hora prevista.'
                : 'As suas rotas, com a ordem das visitas e a hora prevista de cada paragem.'
            }
            actions={
              isManager ? (
                <>
                  <Button icon={ClipboardPlus} onClick={() => setTasking(true)}>
                    Tarefa avulsa
                  </Button>
                  <Button variant="primary" icon={Sparkles} onClick={() => setPlanning(true)}>
                    Planear rota
                  </Button>
                </>
              ) : null
            }
          />
          <Filters day={day} onDay={setDay} assigneeId={assigneeId} onAssignee={setAssigneeId} isManager={isManager} />
          <RoutesForDay project={project} day={day} assigneeId={assigneeId} isManager={isManager} onOpen={setOpenRoute} onPlan={() => setPlanning(true)} />

          <RouteDrawer routeId={openRoute} onClose={() => setOpenRoute(null)} />
          {isManager ? (
            <>
              <PlanRouteModal
                open={planning}
                onClose={() => setPlanning(false)}
                projectId={project.id}
                defaultDay={day}
                onPlanned={(route) => {
                  setPlanning(false);
                  setDay(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Maputo' }).format(new Date(route.date)));
                  setOpenRoute(route.id);
                }}
              />
              <TaskModal open={tasking} onClose={() => setTasking(false)} projectId={project.id} defaultDay={day} />
            </>
          ) : null}
        </>
      )}
    </RequireProject>
  );
}

/* ───────────────────────────── Filtros ───────────────────────────── */

function Filters({
  day,
  onDay,
  assigneeId,
  onAssignee,
  isManager,
}: {
  day: string;
  onDay: (d: string) => void;
  assigneeId: string;
  onAssignee: (id: string) => void;
  isManager: boolean;
}) {
  const reduce = useReducedMotion();
  const team = useTeam(isManager);
  const today = useToday();
  const chips = today
    ? [
        { label: 'Ontem', value: addDays(today, -1) },
        { label: 'Hoje', value: today },
        { label: 'Amanhã', value: addDays(today, 1) },
      ]
    : [];
  return (
    <div className="shadow-soft mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div role="group" aria-label="Dia" className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {chips.map((c) => {
          const active = c.value === day;
          return (
            <button
              key={c.label}
              type="button"
              aria-pressed={active}
              onClick={() => onDay(c.value)}
              className={cn('relative flex-1 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors sm:flex-none', active ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
            >
              {active ? (
                <motion.span
                  layoutId={reduce ? undefined : 'routes-day-chip'}
                  className="shadow-soft absolute inset-0 rounded-lg bg-surface"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              ) : null}
              <span className="relative">{c.label}</span>
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2">
        <CalendarDays className="size-4 shrink-0 text-[var(--accent-text)]" aria-hidden />
        <span className="sr-only">Escolher dia</span>
        <Input type="date" value={day} onChange={(e) => e.target.value && onDay(e.target.value)} className="sm:w-44" />
      </label>
      <p className="text-sm text-ink-2 capitalize sm:mr-auto">{weekday(day)}</p>
      {isManager ? (
        <label className="flex items-center gap-2">
          <span className="text-[13px] font-semibold whitespace-nowrap text-ink-2">Promotor</span>
          <Select value={assigneeId} onChange={(e) => onAssignee(e.target.value)} className="sm:w-56" disabled={team.isPending}>
            <option value="">Todos</option>
            {team.members.map((m) => (
              <option key={m.id} value={m.user.id}>
                {memberLabel(m)}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Lista do dia ───────────────────────────── */

function RoutesForDay({
  project,
  day,
  assigneeId,
  isManager,
  onOpen,
  onPlan,
}: {
  project: Project;
  day: string;
  assigneeId: string;
  isManager: boolean;
  onOpen: (id: string) => void;
  onPlan: () => void;
}) {
  const q = useApi<RouteSummary[]>(['routes', project.id, day, assigneeId], `/projects/${project.id}/routes`, {
    date: day,
    assigneeId: assigneeId || undefined,
  });

  if (q.isPending) {
    return (
      <div aria-busy="true" aria-label="A carregar rotas">
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      </div>
    );
  }
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const routes = [...q.data].sort((a, b) => a.date.localeCompare(b.date) || (a.assignee.name ?? '').localeCompare(b.assignee.name ?? ''));
  const stops = routes.reduce((s, r) => s + r.stops, 0);
  const done = routes.reduce((s, r) => s + r.completed, 0);
  const dist = routes.reduce((s, r) => s + (r.totalDistance ?? 0), 0);
  const mins = routes.reduce((s, r) => s + (r.estimatedMins ?? 0), 0);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile index={0} label="Rotas" value={routes.length} icon={RouteIcon} color="var(--m-rotas)" hint={date(`${day}T12:00:00Z`)} />
        <StatTile index={1} label="Paragens" value={stops} icon={Milestone} color="var(--m-beats)" hint={`${done} concluídas`} />
        <StatTile
          index={2}
          label="Concluídas"
          value={stops ? (done / stops) * 100 : 0}
          format={(v) => `${Math.round(v)}%`}
          icon={CheckCircle2}
          color="var(--m-visitas)"
          hint={`${stops - done} por fazer`}
        />
        <StatTile index={3} label="Km totais" value={dist} format={(v) => km(v)} icon={Gauge} color="var(--m-vendas)" hint="Distância otimizada" />
        <StatTile index={4} label="Tempo estimado" value={mins} format={(v) => minutes(v)} icon={Clock} color="var(--m-dia)" hint="Viagem + visitas" />
      </div>

      {routes.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Rotas do dia">
          {routes.map((r, i) => (
            <RouteCard key={r.id} route={r} index={i} onOpen={() => onOpen(r.id)} />
          ))}
        </ul>
      ) : (
        <Card className="px-4">
          <EmptyState
            illustration="map"
            title={assigneeId ? 'Sem rotas para este promotor neste dia' : 'Sem rotas neste dia'}
            description={
              isManager
                ? 'Planeie uma rota com as lojas a visitar ou gere o plano do dia a partir dos beats.'
                : 'Ainda não tem rotas atribuídas para este dia. Fale com o seu supervisor.'
            }
            action={
              isManager ? (
                <Button variant="primary" icon={Sparkles} onClick={onPlan}>
                  Planear rota
                </Button>
              ) : null
            }
          />
        </Card>
      )}
    </>
  );
}

function RouteCard({ route: r, index, onOpen }: { route: RouteSummary; index: number; onOpen: () => void }) {
  const reduce = useReducedMotion();
  const ratio = r.stops ? r.completed / r.stops : 0;
  const finished = r.stops > 0 && r.completed === r.stops;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
    >
      <Card interactive onClick={onOpen} className="group relative h-full overflow-hidden p-4">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: finished ? 'var(--ok)' : 'linear-gradient(90deg, var(--m-rotas), var(--m-beats))' }}
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-bold text-ink" title={r.name}>
              {r.name}
            </h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-2">
              <Avatar name={r.assignee.name} email={r.assignee.email} size={24} />
              <span className="truncate">{r.assignee.name ?? r.assignee.email}</span>
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[var(--accent-soft)] px-2.5 py-1 text-sm font-bold text-[var(--accent-text)] tabular-nums">
            <Clock className="size-3.5" aria-hidden />
            {time(r.date)}
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
            <span className="text-ink-2">
              {r.completed}/{r.stops} paragens
            </span>
            <span className={finished ? 'text-ok' : 'text-ink-3'}>{finished ? 'Concluída' : `${Math.round(ratio * 100)}%`}</span>
          </div>
          <ProgressBar value={r.completed} max={r.stops || 1} tone={finished ? 'ok' : 'accent'} label={`Progresso de ${r.name}`} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--m-vendas)_12%,transparent)] px-2.5 py-0.5 text-[var(--m-vendas-text)]">
            <Gauge className="size-3.5" aria-hidden />
            {km(r.totalDistance)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--m-dia)_14%,transparent)] px-2.5 py-0.5 text-[var(--m-dia-text)]">
            <Clock className="size-3.5" aria-hidden />
            {minutes(r.estimatedMins)}
          </span>
          <OptimizerBadge by={r.optimizedBy} className="ml-auto" />
        </div>
      </Card>
    </motion.li>
  );
}
