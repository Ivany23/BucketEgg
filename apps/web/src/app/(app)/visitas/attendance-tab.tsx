'use client';

import { ChevronLeft, ChevronRight, Clock, Sunrise, UserCheck, UserX } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { longDay, shiftDay, useNow } from '@/components/field/geo';
import { Avatar, Badge, Card, EmptyState, ErrorState, Field, Input, ListSkeleton, Skeleton, StatTile } from '@/components/ui';
import { minutes, time } from '@/lib/format';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { AttendanceDay } from '@/lib/types';
import { useState } from 'react';
import { useToday } from '@/lib/today';

type AttendanceRecord = AttendanceDay['records'][number];

export function AttendanceTab({ projectId }: { projectId: string }) {
  const { isManager } = useSession();
  const reduce = useReducedMotion();
  const today = useToday() ?? '';
  const [picked, setDate] = useState<string | null>(null);
  const date = picked ?? today;
  const now = useNow();
  const q = useApi<AttendanceDay>(['attendance', projectId, date], date ? `/projects/${projectId}/attendance` : null, { date });

  const records = [...(q.data?.records ?? [])].sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
  const worked = (r: AttendanceRecord) => {
    const end = r.clockOutAt ? Date.parse(r.clockOutAt) : date === today ? now : null;
    return end === null ? null : Math.max(0, end - Date.parse(r.clockInAt)) / 60_000;
  };
  const durations = records.map(worked).filter((v): v is number => v !== null);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const onDuty = records.filter((r) => !r.clockOutAt).length;
  const absent = q.data?.absent ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Dia" className="w-44">
          {(a) => <Input {...a} type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />}
        </Field>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setDate(shiftDay(date, -1))}
            aria-label="Dia anterior"
            className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 hover:bg-surface-2"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDate(shiftDay(date, 1))}
            disabled={date >= today}
            aria-label="Dia seguinte"
            className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 hover:bg-surface-2 disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <p className="pb-2.5 text-sm font-semibold text-ink-2 first-letter:uppercase">{longDay(date)}</p>
      </Card>

      {q.isPending ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <ListSkeleton rows={5} />
        </>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile index={0} label="Presentes" value={q.data.present ?? records.length} icon={UserCheck} color="var(--m-visitas)" hint="registaram entrada" />
            <StatTile index={1} label="Em serviço" value={onDuty} icon={Sunrise} color="var(--m-dia)" hint="ainda sem saída" />
            {isManager ? (
              <StatTile index={2} label="Ausentes" value={absent.length} icon={UserX} color="var(--bad)" hint="promotores sem entrada" />
            ) : null}
            <StatTile index={3} label="Tempo médio" value={avg} format={(v) => minutes(v)} icon={Clock} color="var(--m-rotas)" hint="de trabalho por pessoa" />
          </div>

          {isManager && absent.length ? (
            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                <UserX className="size-4 text-bad" aria-hidden /> Sem registo de entrada ({absent.length})
              </h2>
              <ul className="flex flex-wrap gap-2">
                {absent.map((p) => (
                  <li key={p.id} className="inline-flex items-center gap-2 rounded-full border border-bad/25 bg-bad-soft py-1 pr-3 pl-1 text-sm font-semibold text-ink">
                    <Avatar name={p.name} email={p.email} size={26} />
                    {p.name ?? p.email}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {records.length === 0 ? (
            <Card className="px-4">
              <EmptyState
                illustration="team"
                title="Sem presenças neste dia"
                description="Os registos de entrada e saída aparecem aqui quando a equipa começa o dia em «O meu dia»."
              />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Registos de presença">
              {records.map((r, i) => {
                const mins = worked(r);
                return (
                  <motion.li
                    key={r.id}
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.04, type: 'spring', stiffness: 280, damping: 26 }}
                    className="shadow-soft rounded-2xl border border-line bg-surface p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={r.user.name} email={r.user.email} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink">{r.user.name ?? r.user.email}</p>
                        {r.clockInLat === null ? <p className="text-xs text-ink-3">Entrada sem GPS</p> : null}
                      </div>
                      {r.clockOutAt ? (
                        <Badge tone="neutral">Saiu</Badge>
                      ) : (
                        <Badge tone="ok" icon={Sunrise}>
                          Em serviço
                        </Badge>
                      )}
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <Cell label="Entrada" value={time(r.clockInAt)} color="var(--m-visitas)" />
                      <Cell label="Saída" value={r.clockOutAt ? time(r.clockOutAt) : '—'} color="var(--m-rotas)" />
                      <Cell label="Trabalhado" value={mins === null ? '—' : minutes(mins)} color="var(--m-dia)" />
                    </dl>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-2" style={{ background: `color-mix(in oklab, ${color} 10%, transparent)` }}>
      <dt className="text-[11px] font-semibold text-ink-3">{label}</dt>
      <dd className="text-sm font-extrabold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
