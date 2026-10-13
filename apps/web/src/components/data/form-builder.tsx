'use client';

import { ArrowDown, ArrowUp, Eye, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Button, Field, IconButton, Input, Modal, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/query';
import type { Dataset, FieldType } from '@/lib/types';
import { FieldInput } from './field-input';
import { EDITABLE_TYPES, FIELD_TYPE_META, typeLabel, type DraftValue } from './field-types';

/** Corpo de POST /projects/:id/forms (CreateFormDto; `active` é opcional na API). */
interface CreateFormBody {
  name: string;
  fields: { label: string; type: FieldType }[];
}

interface DraftField {
  uid: string;
  label: string;
  type: FieldType;
}

const INITIAL: DraftField[] = [{ uid: 'f0', label: '', type: 'string' }];
const newUid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `f${Math.random().toString(36).slice(2)}`);

/** Seletor de tipo com uma cor por tipo. */
export function TypePicker({ value, onChange, label }: { value: FieldType; onChange: (t: FieldType) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {EDITABLE_TYPES.map((t) => {
        const meta = FIELD_TYPE_META[t];
        const Icon = meta.icon;
        const active = t === value;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors',
              active ? 'border-transparent' : 'border-line bg-surface text-ink-3 hover:text-ink-2',
            )}
            style={active ? { background: `color-mix(in oklab, ${meta.color} 18%, transparent)`, color: meta.text } : undefined}
          >
            <Icon className="size-3.5" aria-hidden />
            {typeLabel(t)}
          </button>
        );
      })}
    </div>
  );
}

export function FormBuilderModal({
  open,
  onClose,
  projectId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onCreated?: (dataset: Dataset) => void;
}) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [name, setName] = useState('');
  const [fields, setFields] = useState<DraftField[]>(INITIAL);
  const [preview, setPreview] = useState<Record<string, DraftValue>>({});
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setName('');
    setFields(INITIAL);
    setPreview({});
    setSubmitted(false);
  };

  const create = useApiMutation(
    (body: CreateFormBody) => api<Dataset>(`/projects/${projectId}/forms`, { method: 'POST', body }),
    {
      invalidate: [['datasets']],
      onSuccess: (dataset) => {
        toast.success('Formulário criado', `"${dataset.name}" já pode ser preenchido no terreno.`);
        reset();
        onClose();
        onCreated?.(dataset);
      },
      onError: (e) => toast.error('Não foi possível criar o formulário', e.message),
    },
  );

  const update = (uid: string, patch: Partial<DraftField>) => setFields((all) => all.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));
  const move = (index: number, delta: number) =>
    setFields((all) => {
      const next = [...all];
      const target = index + delta;
      if (target < 0 || target >= next.length) return all;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const remove = (uid: string) => setFields((all) => all.filter((f) => f.uid !== uid));
  const add = () => setFields((all) => [...all, { uid: newUid(), label: '', type: 'string' }]);

  const nameError = submitted && name.trim().length < 2 ? 'Dê um nome com pelo menos 2 caracteres.' : null;
  const labelError = (f: DraftField) => (submitted && !f.label.trim() ? 'Escreva a pergunta.' : null);
  const valid = name.trim().length >= 2 && fields.length > 0 && fields.every((f) => f.label.trim());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    create.mutate({ name: name.trim(), fields: fields.map((f) => ({ label: f.label.trim(), type: f.type })) });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      module="dados"
      size="xl"
      title="Novo formulário"
      description="Crie as perguntas que a equipa vai responder no terreno (auditorias, inquéritos, preços…)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="form-builder" loading={create.isPending} icon={Sparkles}>
            Criar formulário
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <form id="form-builder" onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Field label="Nome do formulário" required error={nameError}>
            {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Auditoria de prateleira — Novembro" maxLength={160} />}
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">
                Perguntas <span className="ml-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent-text)] tabular-nums">{fields.length}</span>
              </h3>
            </div>
            <ol className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {fields.map((f, i) => {
                  const meta = FIELD_TYPE_META[f.type];
                  return (
                    <motion.li
                      key={f.uid}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="relative overflow-hidden rounded-2xl border border-line bg-surface p-3 pl-4"
                    >
                      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: meta.color }} />
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-2 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums"
                          style={{ background: `color-mix(in oklab, ${meta.color} 18%, transparent)`, color: meta.text }}
                        >
                          {i + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <Field label={`Pergunta ${i + 1}`} error={labelError(f)} className="[&>label]:sr-only">
                            {(a) => (
                              <Input {...a} value={f.label} maxLength={160} onChange={(e) => update(f.uid, { label: e.target.value })} placeholder="Ex.: Preço na prateleira (MZN)" />
                            )}
                          </Field>
                          <TypePicker value={f.type} onChange={(type) => update(f.uid, { type })} label={`Tipo da pergunta ${i + 1}`} />
                        </div>
                        <div className="flex shrink-0 flex-col sm:flex-row">
                          <IconButton label={`Subir pergunta ${i + 1}`} icon={ArrowUp} disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30" />
                          <IconButton label={`Descer pergunta ${i + 1}`} icon={ArrowDown} disabled={i === fields.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30" />
                          <IconButton label={`Remover pergunta ${i + 1}`} icon={Trash2} tone="danger" disabled={fields.length === 1} onClick={() => remove(f.uid)} className="disabled:opacity-30" />
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
            <Button className="mt-3 w-full border-dashed" icon={Plus} onClick={add}>
              Acrescentar pergunta
            </Button>
          </div>
        </form>

        <section aria-label="Pré-visualização" className="rounded-3xl bg-[var(--accent-soft)] p-3 sm:p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wide text-[var(--accent-text)] uppercase">
            <Eye className="size-4" aria-hidden /> Pré-visualização no telemóvel
          </p>
          <div className="shadow-soft mx-auto max-w-sm rounded-[1.75rem] border border-line bg-surface p-4">
            <p className="text-base font-extrabold break-words text-ink">{name.trim() || 'Formulário sem nome'}</p>
            <p className="mb-4 text-xs text-ink-3">Nova recolha · {fields.length} {fields.length === 1 ? 'pergunta' : 'perguntas'}</p>
            <div className="flex flex-col gap-4">
              {fields.map((f, i) => (
                <FieldInput
                  key={f.uid}
                  label={f.label.trim() || `Pergunta ${i + 1}`}
                  type={f.type}
                  value={preview[f.uid] ?? (f.type === 'boolean' ? null : '')}
                  onChange={(v) => setPreview((p) => ({ ...p, [f.uid]: v }))}
                />
              ))}
            </div>
            <div aria-hidden className="mt-5 flex h-10 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-ink opacity-80">
              Submeter
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
