'use client';

import { ArrowRight, CheckCircle2, Clock, Gauge, Milestone, Wand2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Button, ButtonLink, Field, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { date, km, minutes, time } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import { WEEKDAYS, type BeatDetail, type RouteDetail } from '@/lib/types';
import { FormError, LocationFields, MiniStat, OptimizerBadge, parseLocation, warehouseDraft, type LocationDraft } from './shared';
import { useToday } from '@/lib/today';

export interface GenerateBody {
  date: string;
  startTime?: string;
  startLocation?: { lat: number; lng: number };
}

export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
export const routesLink = (day: string, routeId?: string) => `/rotas?dia=${day}${routeId ? `&rota=${routeId}` : ''}`;

/** Dia, hora de início e ponto de partida (comum a "Gerar rota" e "Gerar plano do dia"). */
export function GenerateFields({
  day,
  onDay,
  startTime,
  onStartTime,
  location,
  onLocation,
  errors,
  dayHint,
}: {
  day: string;
  onDay: (v: string) => void;
  startTime: string;
  onStartTime: (v: string) => void;
  location: LocationDraft;
  onLocation: (v: LocationDraft) => void;
  errors: Partial<Record<'day' | 'time' | 'start', string>>;
  dayHint?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia" required error={errors.day} hint={dayHint}>
          {(a) => <Input {...a} type="date" value={day} onChange={(e) => onDay(e.target.value)} />}
        </Field>
        <Field label="Hora de início" required error={errors.time} hint="Hora de Maputo">
          {(a) => <Input {...a} type="time" value={startTime} onChange={(e) => onStartTime(e.target.value)} />}
        </Field>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-2">Ponto de partida</p>
        <LocationFields value={location} onChange={onLocation} error={errors.start} allowClear />
        <p className="mt-1.5 text-xs text-ink-3">Com ponto de partida, a Google Maps otimiza a ordem (até 25 paragens).</p>
      </div>
    </div>
  );
}

/** Valida o formulário comum; devolve o corpo ou os erros. */
export function buildGenerateBody(day: string, startTime: string, location: LocationDraft) {
  const errors: Partial<Record<'day' | 'time' | 'start', string>> = {};
  if (!day) errors.day = 'Escolha o dia.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) errors.time = 'Hora inválida (HH:MM).';
  const empty = !location.lat.trim() && !location.lng.trim();
  const loc = empty ? null : parseLocation(location);
  if (!empty && !loc) errors.start = 'Coordenadas inválidas.';
  const body: GenerateBody = { date: day, startTime, startLocation: loc ?? undefined };
  return { errors, body: Object.keys(errors).length ? null : body };
}

/** "Gerar rota" de um beat para um dia, com o resumo da rota criada. */
export function GenerateBeatRoute({ beat }: { beat: BeatDetail }) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const today = useToday() ?? '';
  const [pickedDay, setDay] = useState<string>();
  const day = pickedDay ?? today;
  const [startTime, setStartTime] = useState('08:00');
  const [location, setLocation] = useState<LocationDraft>(warehouseDraft);
  const [errors, setErrors] = useState<Partial<Record<'day' | 'time' | 'start', string>>>({});

  const gen = useApiMutation((body: GenerateBody) => api<RouteDetail>(`/beats/${beat.id}/generate-route`, { method: 'POST', body }), {
    invalidate: [['routes'], ['beats'], ['beat', beat.id], ['my-day'], ['dashboard']],
    onSuccess: (route) =>
      toast.success('Rota gerada', route.optimizedBy === 'GOOGLE' ? 'Ordem otimizada pela Google Maps.' : 'Ordem calculada pelo otimizador local.'),
    onError: (e) => toast.error('Não foi possível gerar a rota', e.message),
  });

  const scheduled = day && beat.weekdays.includes(weekdayOf(day));
  const activeOutlets = beat.outlets.filter((b) => b.outlet.status === 'ACTIVE').length;
  const blocked = !beat.assigneeId ? 'Atribua um promotor ao beat para gerar rotas.' : !activeOutlets ? 'O beat não tem lojas ativas.' : null;
  const route = gen.data;

  return (
    <div className="flex flex-col gap-4">
      {blocked ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm font-medium text-warn" role="note">
          {blocked}
        </p>
      ) : null}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const r = buildGenerateBody(day, startTime, location);
          setErrors(r.errors);
          if (r.body) gen.mutate(r.body);
        }}
        className="flex flex-col gap-4"
      >
        <GenerateFields
          day={day}
          onDay={setDay}
          startTime={startTime}
          onStartTime={setStartTime}
          location={location}
          onLocation={setLocation}
          errors={errors}
          dayHint={day ? (scheduled ? `${WEEKDAYS[weekdayOf(day)]}: dia do beat` : `${WEEKDAYS[weekdayOf(day)]}: fora dos dias do beat`) : undefined}
        />
        <FormError error={gen.error} />
        <div className="flex justify-end">
          <Button type="submit" variant="accent" icon={Wand2} loading={gen.isPending} disabled={!!blocked}>
            {gen.isPending ? 'A otimizar…' : 'Gerar rota'}
          </Button>
        </div>
      </form>

      {route ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="rounded-2xl border border-[color-mix(in_oklab,var(--ok)_40%,transparent)] bg-ok-soft/50 p-4"
          role="status"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <CheckCircle2 className="size-5 text-ok" aria-hidden />
            <p className="min-w-0 flex-1 font-bold text-ink">{route.name}</p>
            <OptimizerBadge by={route.optimizedBy} />
          </div>
          <p className="mb-3 text-sm text-ink-2">
            {date(route.date)} · início às {time(route.date)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat icon={Milestone} label="Paragens" value={route.tasks.length} color="var(--m-rotas)" />
            <MiniStat icon={Gauge} label="Distância" value={km(route.totalDistance)} color="var(--m-vendas)" />
            <MiniStat icon={Clock} label="Tempo" value={minutes(route.estimatedMins)} color="var(--m-dia)" />
          </div>
          <div className="mt-3 flex justify-end">
            <ButtonLink href={routesLink(day, route.id)} variant="secondary" size="sm" iconRight={ArrowRight}>
              Ver em Rotas
            </ButtonLink>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
