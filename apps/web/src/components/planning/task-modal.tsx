'use client';

import { ClipboardPlus } from 'lucide-react';
import { useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { date } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import type { Outlet, Task } from '@/lib/types';
import { OutletSingleSelect } from './outlet-picker';
import { FormError, StepTitle, memberLabel, useTeam } from './shared';
import { useToday } from '@/lib/today';

interface CreateTaskBody {
  outletId: string;
  assigneeId: string;
  dueDate: string;
  title?: string;
  notes?: string;
}

type Errors = Partial<Record<'outlet' | 'assignee' | 'dueDate', string>>;

/** "Tarefa avulsa": uma visita fora de rota (aparece no "O meu dia" do promotor). */
export function TaskModal({ open, onClose, projectId, defaultDay }: { open: boolean; onClose: () => void; projectId: string; defaultDay: string }) {
  const today = useToday();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      module="rotas"
      title="Tarefa avulsa"
      description="Uma visita fora de rota — por exemplo, recolher um pagamento ou resolver uma reclamação."
    >
      <TaskForm projectId={projectId} defaultDay={today && defaultDay < today ? today : defaultDay} onClose={onClose} />
    </Modal>
  );
}

function TaskForm({ projectId, defaultDay, onClose }: { projectId: string; defaultDay: string; onClose: () => void }) {
  const toast = useToast();
  const team = useTeam(true);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState(defaultDay);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const create = useApiMutation((body: CreateTaskBody) => api<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body }), {
    invalidate: [['routes'], ['my-day'], ['dashboard']],
    onSuccess: (task) => {
      toast.success('Tarefa criada', `${task.outlet.name} · ${date(task.dueDate)}`);
      onClose();
    },
    onError: (e) => toast.error('Não foi possível criar a tarefa', e.message),
  });

  const submit = () => {
    const e: Errors = {};
    if (!outlet) e.outlet = 'Escolha a loja.';
    if (!assigneeId) e.assignee = 'Escolha o promotor.';
    if (!dueDate) e.dueDate = 'Escolha o dia.';
    setErrors(e);
    if (!outlet || Object.keys(e).length) return;
    create.mutate({
      outletId: outlet.id,
      assigneeId,
      dueDate,
      title: title.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6"
    >
      <section>
        <StepTitle n={1} title="Loja" />
        <OutletSingleSelect projectId={projectId} value={outlet} onChange={setOutlet} error={errors.outlet} />
      </section>
      <section>
        <StepTitle n={2} title="Promotor e dia" />
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
          <Field label="Dia" required error={errors.dueDate}>
            {(a) => <Input {...a} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
          </Field>
        </div>
      </section>
      <section>
        <StepTitle n={3} title="Detalhes" hint="Opcional" />
        <div className="flex flex-col gap-4">
          <Field label="Título">
            {(a) => <Input {...a} value={title} maxLength={160} placeholder="Recolher pagamento pendente" onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field label="Notas para o promotor">
            {(a) => <Textarea {...a} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
        </div>
      </section>
      <FormError error={create.error} />
      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" icon={ClipboardPlus} loading={create.isPending}>
          Criar tarefa
        </Button>
      </div>
    </form>
  );
}
