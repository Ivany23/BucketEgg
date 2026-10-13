'use client';

import { Info, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { MapView, type MapPoint } from '@/components/map';
import { Button, Field, Input, Modal, Select, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/query';
import type { Outlet, RouteDetail } from '@/lib/types';
import { OutletPicker } from './outlet-picker';
import {
  FormError,
  GOOGLE_MAX_STOPS,
  LocationFields,
  MAX_ROUTE_OUTLETS,
  STEP_COLORS,
  StepTitle,
  maputoIso,
  memberLabel,
  parseLocation,
  useTeam,
  warehouseDraft,
  type LocationDraft,
} from './shared';
import { useToday } from '@/lib/today';

interface PlanRouteBody {
  projectId: string;
  assigneeId: string;
  name: string;
  date: string;
  outletIds: string[];
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  serviceMinsPerStop?: number;
}

type Errors = Partial<Record<'name' | 'assignee' | 'day' | 'time' | 'outlets' | 'start' | 'end' | 'service', string>>;

/** "Planear rota": escolhe promotor, dia e lojas; a API otimiza a ordem e cria as paragens. */
export function PlanRouteModal({
  open,
  onClose,
  projectId,
  defaultDay,
  onPlanned,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultDay: string;
  onPlanned: (route: RouteDetail) => void;
}) {
  const today = useToday();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      module="rotas"
      title="Planear rota"
      description="Escolha o promotor, o dia e as lojas. A ordem das visitas é otimizada automaticamente."
    >
      {/* Montado só quando aberto: o formulário recomeça limpo de cada vez. */}
      <PlanRouteForm projectId={projectId} defaultDay={today && defaultDay < today ? today : defaultDay} onClose={onClose} onPlanned={onPlanned} />
    </Modal>
  );
}

function PlanRouteForm({
  projectId,
  defaultDay,
  onClose,
  onPlanned,
}: {
  projectId: string;
  defaultDay: string;
  onClose: () => void;
  onPlanned: (route: RouteDetail) => void;
}) {
  const toast = useToast();
  const team = useTeam(true);
  const [name, setName] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [day, setDay] = useState(defaultDay);
  const [startTime, setStartTime] = useState('08:00');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [start, setStart] = useState<LocationDraft>(warehouseDraft);
  const [useEnd, setUseEnd] = useState(false);
  const [end, setEnd] = useState<LocationDraft>({ lat: '', lng: '' });
  const [service, setService] = useState('15');
  const [errors, setErrors] = useState<Errors>({});

  const plan = useApiMutation((body: PlanRouteBody) => api<RouteDetail>('/routes/plan', { method: 'POST', body }), {
    invalidate: [['routes'], ['my-day'], ['dashboard']],
    onSuccess: (route) => {
      toast.success(
        'Rota planeada',
        `${route.tasks.length} paragens. ${route.optimizedBy === 'GOOGLE' ? 'Ordem otimizada pela Google Maps.' : 'Ordem calculada pelo otimizador local.'}`,
      );
      onPlanned(route);
    },
    onError: (e) => toast.error('Não foi possível planear a rota', e.message),
  });

  const member = team.members.find((m) => m.user.id === assigneeId);
  const autoName = member ? `Rota ${memberLabel(member).split(' ')[0]} — ${day.split('-').reverse().join('/')}` : '';

  const submit = () => {
    const e: Errors = {};
    const finalName = (name.trim() || autoName).trim();
    if (finalName.length < 2) e.name = 'Indique um nome com pelo menos 2 caracteres.';
    if (!assigneeId) e.assignee = 'Escolha o promotor.';
    if (!day) e.day = 'Escolha o dia.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) e.time = 'Hora inválida (HH:MM).';
    if (!outlets.length) e.outlets = 'Escolha pelo menos uma loja.';
    const startLoc = parseLocation(start);
    if (!startLoc) e.start = 'Coordenadas de partida inválidas.';
    const endLoc = useEnd ? parseLocation(end) : null;
    if (useEnd && !endLoc) e.end = 'Coordenadas de chegada inválidas.';
    const mins = Number(service);
    if (!Number.isInteger(mins) || mins < 0 || mins > 480) e.service = 'Entre 0 e 480 minutos.';
    setErrors(e);
    if (Object.keys(e).length) return;
    plan.mutate({
      projectId,
      assigneeId,
      name: finalName,
      date: maputoIso(day, startTime),
      outletIds: outlets.map((o) => o.id),
      startLocation: startLoc ?? undefined,
      endLocation: endLoc ?? undefined,
      serviceMinsPerStop: mins,
    });
  };

  const preview: MapPoint[] = outlets
    .filter((o) => o.latitude != null && o.longitude != null)
    .map((o, i) => ({
      id: o.id,
      lat: o.latitude as number,
      lng: o.longitude as number,
      label: o.name,
      color: STEP_COLORS[i % STEP_COLORS.length],
    }));
  const startPoint = parseLocation(start);

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
      className="flex flex-col gap-7"
    >
      <section>
        <StepTitle n={1} title="Quem e quando" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Promotor" required error={errors.assignee ?? (team.isError ? team.error.message : null)}>
            {(a) => (
              <Select {...a} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} disabled={team.isPending}>
                <option value="">{team.isPending ? 'A carregar equipa…' : 'Escolher promotor…'}</option>
                {team.members.map((m) => (
                  <option key={m.id} value={m.user.id}>
                    {memberLabel(m)}
                    {m.role !== 'FIELD_REP' ? ' (gestão)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nome da rota" error={errors.name} hint={!name && autoName ? `Por omissão: “${autoName}”` : 'Ex.: Rota Baixa — manhã'}>
            {(a) => <Input {...a} value={name} maxLength={120} placeholder={autoName || 'Rota Baixa — manhã'} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Dia" required error={errors.day}>
            {(a) => <Input {...a} type="date" value={day} onChange={(e) => setDay(e.target.value)} />}
          </Field>
          <Field label="Hora de início" required error={errors.time} hint="Hora de Maputo">
            {(a) => <Input {...a} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
          </Field>
        </div>
      </section>

      <section>
        <StepTitle n={2} title="Lojas a visitar" hint={`Só lojas ativas · máximo ${MAX_ROUTE_OUTLETS}`} />
        <OutletPicker projectId={projectId} selected={outlets} onChange={setOutlets} max={MAX_ROUTE_OUTLETS} suggestions />
        {errors.outlets ? (
          <p className="mt-2 text-xs font-medium text-bad" role="alert">
            {errors.outlets}
          </p>
        ) : null}
        {outlets.length > GOOGLE_MAX_STOPS ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-info-soft px-3 py-2 text-xs text-info">
            <Info className="mt-px size-4 shrink-0" aria-hidden />
            Com mais de {GOOGLE_MAX_STOPS} paragens a ordem é calculada pelo otimizador local (a Google Maps otimiza até {GOOGLE_MAX_STOPS} com ponto de partida).
          </p>
        ) : null}
      </section>

      <section>
        <StepTitle n={3} title="Partida e chegada" hint="Com ponto de partida, a Google Maps otimiza a ordem (até 25 paragens)." />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <LocationFields value={start} onChange={setStart} error={errors.start} />
            <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={useEnd}
                onChange={(e) => setUseEnd(e.target.checked)}
                className="size-4 rounded accent-[var(--accent)]"
              />
              Terminar noutro local (por omissão regressa à partida)
            </label>
            {useEnd ? <LocationFields value={end} onChange={setEnd} error={errors.end} allowClear /> : null}
            <Field label="Minutos em cada loja" error={errors.service} hint="Usado para calcular a hora prevista de chegada.">
              {(a) => <Input {...a} type="number" min={0} max={480} step={5} inputMode="numeric" value={service} onChange={(e) => setService(e.target.value)} />}
            </Field>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-2">Pré-visualização</p>
            {preview.length || startPoint ? (
              <MapView points={preview} start={startPoint} height={300} />
            ) : (
              <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-line text-sm text-ink-3">
                Escolha lojas para as ver no mapa.
              </div>
            )}
            <p className="mt-2 text-xs text-ink-3">A ordem final é decidida pelo otimizador ao guardar.</p>
          </div>
        </div>
      </section>

      <FormError error={plan.error} />

      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" icon={plan.isPending ? undefined : Sparkles} loading={plan.isPending}>
          {plan.isPending ? 'A otimizar…' : `Planear e otimizar${outlets.length ? ` (${outlets.length})` : ''}`}
        </Button>
      </div>
    </form>
  );
}
