'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { int } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import type { Project } from '@/lib/types';

/** Confirmação forte: apagar um projeto remove todos os dados associados. */
export function DeleteProjectModal({ project, onClose }: { project: Project | null; onClose: () => void }) {
  return (
    <Modal open={!!project} onClose={onClose} module="painel" size="sm" title="Apagar projeto" description="Esta ação é definitiva e não pode ser anulada.">
      {project ? <DeleteForm key={project.id} project={project} onClose={onClose} /> : null}
    </Modal>
  );
}

function DeleteForm({ project, onClose }: { project: Project; onClose: () => void }) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === project.name.trim();
  const remove = useApiMutation(() => api<{ deleted: boolean }>(`/projects/${project.id}`, { method: 'DELETE' }), {
    invalidate: [['projects']],
    onSuccess: () => {
      toast.success('Projeto apagado', project.name);
      onClose();
    },
    onError: (e) => toast.error('Não foi possível apagar o projeto', e.message),
  });
  const c = project._count;
  const lost: [number, string][] = c
    ? ([
        [c.outlets, 'lojas'],
        [c.routes, 'rotas'],
        [c.orders, 'encomendas'],
        [c.datasets, 'formulários'],
        [c.beats, 'beats'],
      ] satisfies [number, string][]).filter(([n]) => n > 0)
    : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches) remove.mutate(undefined);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div role="note" className="flex gap-3 rounded-xl bg-bad-soft p-3 text-sm text-ink">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
        <div>
          <p className="font-semibold">
            Vai apagar <span className="text-bad">{project.name}</span> e todos os dados associados.
          </p>
          {lost.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {lost.map(([n, label]) => (
                <li key={label} className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-2">
                  {int(n)} {label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-ink-2">O projeto ainda não tem dados.</p>
          )}
          <p className="mt-2 text-xs text-ink-2">Se só quer escondê-lo, arquive-o em vez de o apagar.</p>
        </div>
      </div>
      <Field label={`Escreva "${project.name}" para confirmar`}>
        {(a) => <Input {...a} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} placeholder={project.name} />}
      </Field>
      <div className="-mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="danger" icon={Trash2} disabled={!matches} loading={remove.isPending}>
          Apagar definitivamente
        </Button>
      </div>
    </form>
  );
}
