'use client';

import { FolderPlus, Save } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { useApiMutation } from '@/lib/query';
import type { Project } from '@/lib/types';

type CreateProjectBody = components['schemas']['CreateProjectDto'];
type UpdateProjectBody = components['schemas']['UpdateProjectDto'];

const SUGGESTED = ['Bebidas', 'Alimentar', 'Higiene e limpeza', 'Trade marketing', 'Telecomunicações', 'Farmácia'];

/** Criar (project = null) ou editar um projeto. */
export function ProjectFormModal({
  open,
  project,
  categories,
  onClose,
  onCreated,
}: {
  open: boolean;
  project: Project | null;
  categories: string[];
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      module="painel"
      title={project ? 'Editar projeto' : 'Novo projeto'}
      description={
        project
          ? 'Altere o nome, a categoria ou a descrição. Os dados do projeto não são afetados.'
          : 'Um projeto (campanha) agrupa lojas, rotas, beats, encomendas e formulários.'
      }
    >
      <ProjectForm key={project?.id ?? 'new'} project={project} categories={categories} onClose={onClose} onCreated={onCreated} />
    </Modal>
  );
}

function ProjectForm({
  project,
  categories,
  onClose,
  onCreated,
}: {
  project: Project | null;
  categories: string[];
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const toast = useToast();
  const listId = useId();
  const [name, setName] = useState(project?.name ?? '');
  const [category, setCategory] = useState(project?.category ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [errors, setErrors] = useState<{ name?: string; category?: string; description?: string; form?: string }>({});

  const save = useApiMutation(
    (body: CreateProjectBody | UpdateProjectBody) =>
      project ? api<Project>(`/projects/${project.id}`, { method: 'PATCH', body }) : api<Project>('/projects', { method: 'POST', body }),
    {
      invalidate: [['projects']],
      onSuccess: (p) => {
        if (project) toast.success('Projeto atualizado', p.name);
        else onCreated(p);
        onClose();
      },
      onError: (e) => setErrors({ form: e.message }),
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const next: typeof errors = {};
    if (n.length < 2) next.name = 'O nome precisa de pelo menos 2 caracteres.';
    if (n.length > 120) next.name = 'Máximo de 120 caracteres.';
    if (category.trim().length > 80) next.category = 'Máximo de 80 caracteres.';
    if (description.length > 1000) next.description = 'Máximo de 1000 caracteres.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const body = project
      ? { name: n, category: category.trim(), description: description.trim() }
      : { name: n, category: category.trim() || undefined, description: description.trim() || undefined };
    save.mutate(body);
  };

  const options = Array.from(new Set([...categories, ...SUGGESTED]));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {errors.form ? (
        <p role="alert" className="rounded-xl border border-bad/40 bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad">
          {errors.form}
        </p>
      ) : null}
      <Field label="Nome" required error={errors.name}>
        {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Campanha Verão 2026" maxLength={120} />}
      </Field>
      <Field label="Categoria" error={errors.category} hint="Escolha uma sugestão ou escreva livremente.">
        {(a) => (
          <>
            <Input {...a} list={listId} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: Bebidas" maxLength={80} />
            <datalist id={listId}>
              {options.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="Descrição" error={errors.description} hint={`${description.length}/1000`}>
        {(a) => (
          <Textarea
            {...a}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Objetivo, zonas e produtos da campanha…"
            maxLength={1000}
          />
        )}
      </Field>
      <div className="-mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" icon={project ? Save : FolderPlus} loading={save.isPending}>
          {project ? 'Guardar' : 'Criar projeto'}
        </Button>
      </div>
    </form>
  );
}
