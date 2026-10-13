'use client';

import { Check, Clock, History, LogIn, MapPin, Navigation, Phone, Route as RouteIcon, StickyNote, X, XCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useState } from 'react';
import { DEMO_GPS, GEO_MESSAGES, GeoError, meters, useLocate, type Coords } from '@/components/field/geo';
import { GpsFailModal, errorText, stepColor, type ActiveVisit } from '@/components/field/shared';
import { TaskStatusBadge } from '@/components/domain';
import { Button, Field, Input, Modal, cn, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { ago, time } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import type { Task, Visit } from '@/lib/types';

interface CheckInBody {
  outletId: string;
  taskId?: string;
  lat: number;
  lng: number;
}

const MISSED_REASONS = ['Loja fechada', 'Responsável ausente', 'Sem tempo (rota atrasada)', 'Acesso impossível', 'Loja já não existe', 'Outro'] as const;

const linkBtn =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-sm font-semibold whitespace-nowrap text-ink transition-colors hover:bg-surface-2 active:scale-[0.97]';

export const stopDomId = (taskId: string) => `paragem-${taskId}`;

export function directionsUrl(t: Task): string | null {
  const o = t.outlet;
  if (o.latitude !== null && o.longitude !== null) return `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`;
  if (o.address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${o.name}, ${o.address}`)}`;
  return null;
}

/** Linha do tempo das paragens do dia com ações de terreno. */
export function StopsTimeline({
  tasks,
  canAct,
  active,
  selectedId,
  onSelect,
}: {
  tasks: Task[];
  /** Ações de check-in / não visitada (só no dia de hoje). */
  canAct: boolean;
  active: ActiveVisit | null | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const { locate, locating } = useLocate();
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [gpsFail, setGpsFail] = useState<{ task: Task; message: string } | null>(null);
  const [missed, setMissed] = useState<Task | null>(null);
  const [missedKey, setMissedKey] = useState(0);

  const checkIn = useApiMutation((body: CheckInBody) => api<Visit>('/visits/check-in', { method: 'POST', body }), {
    invalidate: [['visits'], ['my-day'], ['dashboard']],
    onSuccess: (v) => {
      const where = v.distanceM !== null ? `A ${meters(v.distanceM)} da loja.` : 'Loja sem GPS: ficou geo-referenciada agora.';
      toast.success(`Check-in em ${v.outlet?.name ?? 'loja'}`, where);
      if (!v.withinGeofence) {
        toast.warn('Fora do raio da loja', `Está a ${meters(v.distanceM)} da loja. A visita fica registada, mas sinalizada para o supervisor.`);
      }
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) toast.error('Já tem uma visita em curso', 'Faça check-out da visita atual antes de começar outra.');
      else toast.error('Não foi possível fazer o check-in', e.message);
    },
  });

  const sendCheckIn = (task: Task, pos: Coords) => {
    setBusyTask(task.id);
    checkIn.mutate({ outletId: task.outletId, taskId: task.id, lat: pos.lat, lng: pos.lng }, { onSettled: () => setBusyTask(null) });
  };

  const startCheckIn = async (task: Task) => {
    setGpsFail(null);
    setBusyTask(task.id);
    try {
      const pos = await locate();
      sendCheckIn(task, pos);
    } catch (e) {
      setBusyTask(null);
      setGpsFail({ task, message: e instanceof GeoError ? e.message : GEO_MESSAGES.unavailable });
    }
  };

  const simulateAt = gpsFail && DEMO_GPS && gpsFail.task.outlet.latitude !== null && gpsFail.task.outlet.longitude !== null ? gpsFail.task : null;

  return (
    <>
      <ol className="relative flex flex-col gap-3" aria-label="Paragens do dia">
        {tasks.map((t, i) => {
          const color = stepColor(i);
          const isActiveHere = active?.taskId === t.id || (active && !active.taskId && active.outletId === t.outletId && t.status === 'IN_PROGRESS');
          const open = t.status === 'PENDING' || (t.status === 'IN_PROGRESS' && !isActiveHere);
          const done = t.status === 'COMPLETED';
          const failed = t.status === 'MISSED' || t.status === 'CANCELLED';
          const url = directionsUrl(t);
          const lastVisit = t.visits[t.visits.length - 1];
          const selected = selectedId === t.id;
          return (
            <motion.li
              key={t.id}
              id={stopDomId(t.id)}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.045, type: 'spring', stiffness: 280, damping: 26 }}
              className="relative scroll-mt-24 pl-14"
            >
              {i < tasks.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-12 -bottom-3 left-[21px] w-1 rounded-full"
                  style={{ background: `linear-gradient(${color}, ${stepColor(i + 1)})`, opacity: 0.35 }}
                />
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                aria-label={`Paragem ${i + 1}: mostrar no mapa`}
                className="absolute top-3 left-0 inline-flex size-11 items-center justify-center rounded-2xl text-base font-extrabold text-[#10141c] shadow-soft transition-transform hover:scale-105"
                style={{ background: color }}
              >
                {i + 1}
                {done || failed ? (
                  <span
                    aria-hidden
                    className={cn('absolute -right-1.5 -bottom-1.5 inline-flex size-5 items-center justify-center rounded-full border-2 border-bg text-white', done ? 'bg-ok' : 'bg-bad')}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                  </span>
                ) : null}
              </button>

              <article
                className={cn(
                  'shadow-soft rounded-2xl border bg-surface p-4 transition-[box-shadow,border-color]',
                  selected ? 'border-[var(--accent)] shadow-lift' : 'border-line',
                  isActiveHere && 'border-ok ring-2 ring-ok/30',
                  (done || failed) && !selected && 'opacity-85',
                )}
                aria-labelledby={`${t.id}-name`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 id={`${t.id}-name`} className="truncate text-[15px] font-bold text-ink">
                      {t.outlet.name}
                    </h3>
                    {t.title ? <p className="text-sm font-semibold text-[var(--accent-text)]">{t.title}</p> : null}
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{[t.outlet.address, t.outlet.zone].filter(Boolean).join(' · ') || 'Sem morada'}</span>
                    </p>
                  </div>
                  <TaskStatusBadge status={t.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
                  {t.estArrival ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" style={{ color }} aria-hidden />
                      Chegada prevista <strong className="font-bold text-ink tabular-nums">{time(t.estArrival)}</strong>
                    </span>
                  ) : null}
                  {t.route ? (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <RouteIcon className="size-3.5 text-[var(--m-rotas-text)]" aria-hidden />
                      <span className="max-w-48 truncate">{t.route.name}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--m-beats-text)]">
                      <RouteIcon className="size-3.5" aria-hidden /> Tarefa avulsa
                    </span>
                  )}
                  {lastVisit ? (
                    <span className="inline-flex items-center gap-1.5">
                      <History className="size-3.5 text-[var(--m-visitas-text)]" aria-hidden />
                      Visita {time(lastVisit.checkInAt)}
                      {lastVisit.checkOutAt ? `–${time(lastVisit.checkOutAt)}` : ' (em curso)'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <History className="size-3.5 text-ink-3" aria-hidden />
                      Última visita: {t.outlet.lastVisitedAt ? ago(t.outlet.lastVisitedAt) : 'nunca'}
                    </span>
                  )}
                </div>

                {t.notes ? (
                  <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="whitespace-pre-line">{t.notes}</span>
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {canAct && open ? (
                    <Button
                      variant="primary"
                      icon={LogIn}
                      loading={busyTask === t.id && (locating || checkIn.isPending)}
                      disabled={!!active || (busyTask !== null && busyTask !== t.id)}
                      title={active ? 'Termine a visita em curso primeiro' : undefined}
                      onClick={() => startCheckIn(t)}
                    >
                      {busyTask === t.id && locating ? 'A obter GPS…' : 'Check-in'}
                    </Button>
                  ) : null}
                  {isActiveHere ? (
                    <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-ok-soft px-3.5 text-sm font-bold text-ok">
                      <span aria-hidden className="size-2 animate-pulse rounded-full bg-ok" /> Em visita agora
                    </span>
                  ) : null}
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                      <Navigation className="size-4 text-[var(--m-rotas-text)]" aria-hidden />
                      Navegar
                      <span className="sr-only"> até {t.outlet.name} (abre o Google Maps)</span>
                    </a>
                  ) : null}
                  {t.outlet.phone ? (
                    <a href={`tel:${t.outlet.phone.replace(/\s+/g, '')}`} className={linkBtn}>
                      <Phone className="size-4 text-[var(--m-visitas-text)]" aria-hidden />
                      Ligar
                      <span className="sr-only"> para {t.outlet.contactName ?? t.outlet.name}</span>
                    </a>
                  ) : null}
                  {canAct && t.status === 'PENDING' ? (
                    <Button
                      variant="ghost"
                      icon={XCircle}
                      onClick={() => {
                        setMissedKey((k) => k + 1);
                        setMissed(t);
                      }}
                    >
                      Não visitada
                    </Button>
                  ) : null}
                </div>
                {canAct && open && active ? <p className="mt-2 text-xs text-ink-3">Termine a visita em curso para fazer check-in aqui.</p> : null}
              </article>
            </motion.li>
          );
        })}
      </ol>

      <GpsFailModal
        open={!!gpsFail}
        module="dia"
        message={gpsFail?.message ?? ''}
        onClose={() => setGpsFail(null)}
        retrying={locating}
        onRetry={() => gpsFail && startCheckIn(gpsFail.task)}
        fallbacks={
          simulateAt
            ? [
                {
                  label: 'Simular GPS na loja',
                  hint: 'Só em demonstração: usa as coordenadas da loja como se estivesse lá.',
                  onClick: () => {
                    setGpsFail(null);
                    sendCheckIn(simulateAt, { lat: simulateAt.outlet.latitude as number, lng: simulateAt.outlet.longitude as number, simulated: true });
                  },
                },
              ]
            : []
        }
      />
      <MissedModal key={missedKey} task={missed} onClose={() => setMissed(null)} />
    </>
  );
}

/** Marcar paragem como não visitada, com motivo. */
function MissedModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const toast = useToast();
  const group = useId();
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mark = useApiMutation(
    ({ id, notes }: { id: string; notes: string }) => api<Task>(`/tasks/${id}`, { method: 'PATCH', body: { status: 'MISSED', notes } }),
    {
      invalidate: [['my-day'], ['routes'], ['dashboard']],
      onSuccess: () => {
        toast.info('Paragem marcada como não visitada', task?.outlet.name);
        onClose();
      },
      onError: (e) => toast.error('Não foi possível atualizar a paragem', errorText(e)),
    },
  );

  const submit = () => {
    if (!task) return;
    const text = reason === 'Outro' ? other.trim() : reason;
    if (!text) {
      setError(reason === 'Outro' ? 'Descreva o motivo.' : 'Escolha um motivo.');
      return;
    }
    const line = `Não visitada: ${text}`;
    mark.mutate({ id: task.id, notes: (task.notes ? `${task.notes}\n${line}` : line).slice(0, 2000) });
  };

  return (
    <Modal
      open={!!task}
      onClose={onClose}
      size="sm"
      module="dia"
      title="Paragem não visitada"
      description={task?.outlet.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" icon={XCircle} loading={mark.isPending} onClick={submit}>
            Marcar não visitada
          </Button>
        </>
      }
    >
      <fieldset aria-describedby={error ? `${group}-err` : undefined}>
        <legend className="mb-2 text-[13px] font-semibold text-ink-2">
          Porque não foi possível visitar? <span className="text-bad">*</span>
        </legend>
        <div className="flex flex-col gap-1.5">
          {MISSED_REASONS.map((r) => (
            <label
              key={r}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                reason === r ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-ink' : 'border-line text-ink-2 hover:bg-surface-2',
              )}
            >
              <input
                type="radio"
                name={`${group}-r`}
                value={r}
                checked={reason === r}
                onChange={() => {
                  setReason(r);
                  setError(null);
                }}
                className="size-4 accent-[var(--accent)]"
              />
              {r}
            </label>
          ))}
        </div>
        {reason === 'Outro' ? (
          <Field label="Qual o motivo?" required className="mt-3">
            {(a) => <Input {...a} maxLength={300} value={other} onChange={(e) => setOther(e.target.value)} />}
          </Field>
        ) : null}
        {error ? (
          <p id={`${group}-err`} role="alert" className="mt-2 text-xs font-medium text-bad">
            {error}
          </p>
        ) : null}
      </fieldset>
    </Modal>
  );
}
