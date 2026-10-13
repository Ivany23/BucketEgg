'use client';

import { Columns3, Plus, Save, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Button, IconButton, Input, Modal, Switch, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/query';
import type { Dataset, FieldType } from '@/lib/types';
import { TypePicker } from './form-builder';
import { FieldTypeChip, FieldTypeDot, nextFieldKey, schemaFields } from './field-types';

/** Corpo de PATCH /datasets/:id/schema (UpdateSchemaDto): só as chaves alteradas ou novas. */
interface UpdateSchemaBody {
  fields: Record<string, { label?: string; type?: FieldType; active?: boolean }>;
}

export function SchemaEditorModal({ dataset, open, onClose }: { dataset: Pick<Dataset, 'id' | 'name' | 'schema'>; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const save = useApiMutation((body: UpdateSchemaBody) => api<Dataset>(`/datasets/${dataset.id}/schema`, { method: 'PATCH', body }), {
    invalidate: [['datasets'], ['dataset-records', dataset.id]],
  });
  const close = () => {
    save.reset();
    onClose();
  };
  const submit = (body: UpdateSchemaBody) =>
    save.mutate(body, {
      onSuccess: () => {
        toast.success('Esquema atualizado', 'As colunas e perguntas foram guardadas.');
        close();
      },
      onError: (e) => toast.error('Não foi possível guardar o esquema', e.message),
    });
  return (
    <Modal
      open={open}
      onClose={close}
      module="dados"
      size="lg"
      title="Colunas e perguntas"
      description={`Renomeie, oculte ou acrescente campos em "${dataset.name}". Ocultar não apaga dados.`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="schema-editor" icon={Save} loading={save.isPending}>
            Guardar alterações
          </Button>
        </>
      }
    >
      <SchemaEditorBody key={Object.keys(dataset.schema).join('|')} dataset={dataset} onSubmit={submit} />
    </Modal>
  );
}

interface NewField {
  key: string;
  label: string;
  type: FieldType;
}

function SchemaEditorBody({ dataset, onSubmit }: { dataset: Pick<Dataset, 'schema'>; onSubmit: (b: UpdateSchemaBody) => void }) {
  const reduce = useReducedMotion();
  const fields = schemaFields(dataset.schema);
  const [edits, setEdits] = useState<Record<string, { label: string; active: boolean }>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, { label: f.label, active: f.active !== false }])),
  );
  const [added, setAdded] = useState<NewField[]>([]);
  const [tried, setTried] = useState(false);

  const addField = () =>
    setAdded((list) => {
      const taken = { ...dataset.schema, ...Object.fromEntries(list.map((f) => [f.key, { label: f.label, type: f.type, active: true }])) };
      return [...list, { key: nextFieldKey(taken), label: '', type: 'string' }];
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    const body: UpdateSchemaBody = { fields: {} };
    for (const f of fields) {
      const ed = edits[f.key];
      const patch: { label?: string; active?: boolean } = {};
      if (ed.label.trim() && ed.label.trim() !== f.label) patch.label = ed.label.trim();
      if (ed.active !== (f.active !== false)) patch.active = ed.active;
      if (Object.keys(patch).length) body.fields[f.key] = patch;
    }
    if (fields.some((f) => !edits[f.key].label.trim()) || added.some((f) => !f.label.trim())) return;
    for (const f of added) body.fields[f.key] = { label: f.label.trim(), type: f.type, active: true };
    if (!Object.keys(body.fields).length) return;
    onSubmit(body);
  };

  const dirty =
    added.length > 0 || fields.some((f) => edits[f.key].label.trim() !== f.label || edits[f.key].active !== (f.active !== false));

  return (
    <form id="schema-editor" onSubmit={submit} noValidate>
      <ul className="flex flex-col gap-2.5">
        {fields.map((f, i) => {
          const ed = edits[f.key];
          const empty = tried && !ed.label.trim();
          return (
            <motion.li
              key={f.key}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.03, type: 'spring', stiffness: 300, damping: 28 }}
              className={cn('rounded-2xl border border-line p-3 transition-opacity', !ed.active && 'bg-surface-2/60')}
            >
              <div className="flex flex-wrap items-center gap-3">
                <FieldTypeDot type={f.type} />
                <label className="min-w-0 flex-1 basis-48">
                  <span className="sr-only">Nome do campo {i + 1}</span>
                  <Input
                    value={ed.label}
                    maxLength={160}
                    aria-invalid={empty || undefined}
                    className={cn(!ed.active && 'text-ink-3 line-through')}
                    onChange={(e) => setEdits((all) => ({ ...all, [f.key]: { ...all[f.key], label: e.target.value } }))}
                  />
                </label>
                <Switch
                  checked={ed.active}
                  label={ed.active ? 'Visível' : 'Oculto'}
                  onChange={(v) => setEdits((all) => ({ ...all, [f.key]: { ...all[f.key], active: v } }))}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-11 text-xs text-ink-3">
                <FieldTypeChip type={f.type} />
                {f.originalName ? <span>Coluna original: “{f.originalName}”</span> : null}
                {empty ? <span className="font-semibold text-bad">O nome não pode ficar vazio.</span> : null}
              </div>
            </motion.li>
          );
        })}
      </ul>

      <AnimatePresence initial={false}>
        {added.map((f, i) => (
          <motion.div
            key={f.key}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 rounded-2xl border-2 border-dashed border-[var(--accent)]/50 bg-[var(--accent-soft)] p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--accent-text)] uppercase">Novo</span>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Nome do novo campo {i + 1}</span>
                  <Input
                    value={f.label}
                    maxLength={160}
                    placeholder="Nome da nova pergunta"
                    aria-invalid={(tried && !f.label.trim()) || undefined}
                    onChange={(e) => setAdded((list) => list.map((x) => (x.key === f.key ? { ...x, label: e.target.value } : x)))}
                  />
                </label>
                <IconButton label="Remover novo campo" icon={Trash2} tone="danger" onClick={() => setAdded((list) => list.filter((x) => x.key !== f.key))} />
              </div>
              <div className="mt-2">
                <TypePicker
                  value={f.type}
                  label={`Tipo do novo campo ${i + 1}`}
                  onChange={(type) => setAdded((list) => list.map((x) => (x.key === f.key ? { ...x, type } : x)))}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <Button className="mt-3 w-full border-dashed" icon={Plus} onClick={addField}>
        Acrescentar campo
      </Button>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3" role="status">
        <Columns3 className="size-3.5" aria-hidden />
        {dirty ? 'Tem alterações por guardar.' : 'Sem alterações.'} O tipo dos campos existentes não muda, para proteger os dados já recolhidos.
      </p>
    </form>
  );
}
