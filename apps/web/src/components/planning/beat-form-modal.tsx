'use client';

import { Save } from 'lucide-react';
import { useState } from 'react';
import { MapView, type MapPoint } from '@/components/map';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/query';
import type { BeatDetail, Outlet } from '@/lib/types';
import { OutletPicker } from './outlet-picker';
import { FormError, MAX_ROUTE_OUTLETS, StepTitle, WeekdayToggles, memberLabel, useTeam } from './shared';

interface BeatBody {
  name: string;
  description?: string | null;
  weekdays: number[];
  assigneeId?: string | null;
  outletIds: string[];
}

type Errors = Partial<Record<'name' | 'weekdays', string>>;

/** Criar ou editar um beat (circuito semanal). */
export function BeatFormModal({
  open,
  onClose,
  projectId,
  beat,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Beat a editar (ausente = criar). */
  beat?: BeatDetail | null;
  onSaved: (beat: BeatDetail) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      module="beats"
      title={beat ? 'Editar beat' : 'Novo beat'}
      description="Um beat é um circuito fixo de lojas, visitado nos mesmos dias todas as semanas."
    >
      <BeatForm projectId={projectId} beat={beat ?? null} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function BeatForm({ projectId, beat, onClose, onSaved }: { projectId: string; beat: BeatDetail | null; onClose: () => void; onSaved: (b: BeatDetail) => void }) {
  const toast = useToast();
  const team = useTeam(true);
  const [name, setName] = useState(beat?.name ?? '');
  const [description, setDescription] = useState(beat?.description ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(beat?.weekdays ?? [1]);
  const [assigneeId, setAssigneeId] = useState(beat?.assigneeId ?? '');
  const [outlets, setOutlets] = useState<Outlet[]>(() => beat?.outlets.map((b) => b.outlet) ?? []);
  const [errors, setErrors] = useState<Errors>({});

  const save = useApiMutation(
    (body: BeatBody) =>
      beat ? api<BeatDetail>(`/beats/${beat.id}`, { method: 'PATCH', body }) : api<BeatDetail>(`/projects/${projectId}/beats`, { method: 'POST', body }),
    {
      invalidate: [['beats'], ['beat']],
      onSuccess: (saved) => {
        toast.success(beat ? 'Beat atualizado' : 'Beat criado', `${saved.name} · ${saved.outlets.length} lojas`);
        onSaved(saved);
      },
      onError: (e) => toast.error(beat ? 'Não foi possível guardar o beat' : 'Não foi possível criar o beat', e.message),
    },
  );

  const submit = () => {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = 'Indique um nome com pelo menos 2 caracteres.';
    if (!weekdays.length) e.weekdays = 'Escolha pelo menos um dia (sem dias, o beat nunca entra no plano do dia).';
    setErrors(e);
    if (Object.keys(e).length) return;
    const desc = description.trim();
    save.mutate({
      name: name.trim(),
      // Ao editar, null limpa o campo; ao criar, omitir.
      description: desc || (beat ? null : undefined),
      weekdays,
      assigneeId: assigneeId || (beat ? null : undefined),
      outletIds: outlets.map((o) => o.id),
    });
  };

  const preview: MapPoint[] = outlets
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o.latitude != null && o.longitude != null)
    .map(({ o, i }) => ({ id: o.id, lat: o.latitude as number, lng: o.longitude as number, label: `${i + 1}. ${o.name}`, number: i + 1, color: 'var(--m-beats)' }));

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
        <StepTitle n={1} title="Identificação" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required error={errors.name}>
            {(a) => <Input {...a} value={name} maxLength={120} placeholder="Beat Baixa — Segunda/Quinta" onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Promotor responsável" hint="Sem promotor, o beat não gera rotas." error={team.isError ? team.error.message : null}>
            {(a) => (
              <Select {...a} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} disabled={team.isPending}>
                <option value="">{team.isPending ? 'A carregar equipa…' : 'Sem promotor'}</option>
                {team.members.map((m) => (
                  <option key={m.id} value={m.user.id}>
                    {memberLabel(m)}
                    {m.role !== 'FIELD_REP' ? ' (gestão)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            {(a) => <Textarea {...a} value={description} maxLength={500} className="min-h-16" placeholder="Circuito semanal do centro da cidade" onChange={(e) => setDescription(e.target.value)} />}
          </Field>
        </div>
      </section>

      <section>
        <StepTitle n={2} title="Dias da semana" hint="Nesses dias, “Gerar plano do dia” cria a rota automaticamente." />
        <WeekdayToggles value={weekdays} onChange={setWeekdays} />
        {errors.weekdays ? (
          <p className="mt-2 text-xs font-medium text-bad" role="alert">
            {errors.weekdays}
          </p>
        ) : null}
      </section>

      <section>
        <StepTitle n={3} title="Lojas e ordem" hint="A ordem é guardada; ao gerar a rota, o otimizador decide a melhor sequência do dia." />
        <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,320px)]">
          <OutletPicker projectId={projectId} selected={outlets} onChange={setOutlets} max={MAX_ROUTE_OUTLETS} ordered />
          <div className="lg:sticky lg:top-0 lg:self-start">
            {preview.length ? (
              <MapView points={preview} path height={280} />
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-line px-4 text-center text-sm text-ink-3">
                As lojas escolhidas aparecem aqui no mapa.
              </div>
            )}
          </div>
        </div>
      </section>

      <FormError error={save.error} />

      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" icon={Save} loading={save.isPending}>
          {beat ? 'Guardar alterações' : 'Criar beat'}
        </Button>
      </div>
    </form>
  );
}
