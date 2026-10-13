'use client';

import { AlertTriangle, Crosshair, LocateFixed, MapPin, RefreshCw, Save, Send, Store, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Button, Field, Modal, SearchInput, Select, Textarea, useToast } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { useApi, useApiMutation } from '@/lib/query';
import type { DataRecord, Dataset, DatasetSchema, Outlet, Page } from '@/lib/types';
import { FieldInput } from './field-input';
import { apiErrorList, fromDraft, humanizeApiError, schemaFields, toDraft, type DraftValue } from './field-types';

/* ───────────────────────── Peças comuns ───────────────────────── */

function ApiErrors({ error }: { error: ApiError | null }) {
  if (!error) return null;
  const list = apiErrorList(error.body);
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-2xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad"
    >
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle className="size-4 shrink-0" aria-hidden /> {error.message}
      </p>
      {list.length ? (
        <ul className="mt-1.5 list-disc pl-6 text-[13px] font-medium">
          {list.map((m) => (
            <li key={m}>{humanizeApiError(m)}</li>
          ))}
        </ul>
      ) : null}
    </motion.div>
  );
}

/** Valida os rascunhos localmente (números e datas) antes de enviar. */
function collect(schema: DatasetSchema, drafts: Record<string, DraftValue>, keys: string[]) {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const key of keys) {
    const type = schema[key]?.type ?? 'string';
    const v = fromDraft(drafts[key] ?? null, type);
    if (v instanceof Error) errors[key] = v.message;
    else values[key] = v;
  }
  return { values, errors };
}

/** Escolher a loja onde a recolha foi feita (opcional). */
export function OutletPicker({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
}) {
  const [search, setSearch] = useState('');
  const q = useApi<Page<Outlet>>(['outlets', projectId, 'picker', search], `/projects/${projectId}/outlets`, { search, limit: 20 });
  const options = q.data?.data ?? [];
  const hasSelected = !!value && options.some((o) => o.id === value.id);
  return (
    <fieldset className="rounded-2xl border border-line p-3">
      <legend className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-ink-2">
        <Store className="size-4" style={{ color: 'var(--m-lojas)' }} aria-hidden /> Loja <span className="font-normal text-ink-3">(opcional)</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Procurar loja…" label="Procurar loja" />
        <label className="block">
          <span className="sr-only">Loja</span>
          <Select
            value={value?.id ?? ''}
            onChange={(e) => {
              const o = options.find((x) => x.id === e.target.value);
              onChange(o ? { id: o.id, name: o.name } : null);
            }}
            aria-busy={q.isFetching || undefined}
          >
            <option value="">{q.isPending ? 'A carregar lojas…' : 'Sem loja associada'}</option>
            {value && !hasSelected ? <option value={value.id}>{value.name}</option> : null}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.zone ? ` — ${o.zone}` : ''}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {q.isError ? <p className="mt-2 text-xs text-bad">Não foi possível carregar as lojas: {q.error.message}</p> : null}
      {!q.isPending && !options.length && !q.isError ? <p className="mt-2 text-xs text-ink-3">Nenhuma loja encontrada{search ? ` para "${search}"` : ''}.</p> : null}
    </fieldset>
  );
}

export interface GpsFix {
  lat: number;
  lng: number;
  accuracy: number;
}

/** Captura opcional da localização (GPS do telemóvel/browser). */
export function GpsCapture({ value, onChange }: { value: GpsFix | null; onChange: (v: GpsFix | null) => void }) {
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const capture = () => {
    if (!('geolocation' in navigator)) {
      setState({ loading: false, error: 'Este dispositivo não permite obter a localização.' });
      return;
    }
    setState({ loading: true, error: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setState({ loading: false, error: null });
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Autorize o acesso à localização nas definições do browser.'
            : err.code === err.TIMEOUT
              ? 'O GPS demorou demasiado. Tente num local aberto.'
              : 'Não foi possível obter a localização.';
        setState({ loading: false, error: msg });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };
  return (
    <div className="rounded-2xl border border-line p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
        <MapPin className="size-4" style={{ color: 'var(--m-rotas)' }} aria-hidden /> Localização GPS <span className="font-normal text-ink-3">(opcional)</span>
      </p>
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {value ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-ok-soft px-3 py-2 text-xs font-semibold text-ok">
              <LocateFixed className="size-4" aria-hidden />
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)} · ±{Math.round(value.accuracy)} m
            </span>
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={capture} loading={state.loading}>
              Atualizar
            </Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => onChange(null)}>
              Remover
            </Button>
          </>
        ) : (
          <Button size="sm" variant="soft" icon={Crosshair} onClick={capture} loading={state.loading}>
            {state.loading ? 'A obter localização…' : 'Capturar localização'}
          </Button>
        )}
      </div>
      {state.error ? (
        <p className="mt-2 text-xs font-medium text-bad" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/* ───────────────────────── Nova recolha ───────────────────────── */

interface SubmitBody {
  data: Record<string, unknown>;
  outletId?: string;
  gpsLat?: number;
  gpsLng?: number;
}

export function SubmitRecordModal({
  open,
  onClose,
  dataset,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  dataset: Pick<Dataset, 'id' | 'name' | 'schema'>;
  projectId: string;
}) {
  const toast = useToast();
  const submit = useApiMutation((body: SubmitBody) => api<DataRecord>(`/datasets/${dataset.id}/records`, { method: 'POST', body }), {
    invalidate: [['dataset-records', dataset.id], ['datasets']],
  });
  const close = () => {
    submit.reset();
    onClose();
  };
  const send = (body: SubmitBody) =>
    submit.mutate(body, {
      onSuccess: () => {
        toast.success('Recolha submetida', 'Obrigado! Os dados ficaram guardados.');
        close();
      },
    });
  return (
    <Modal
      open={open}
      onClose={close}
      module="dados"
      size="lg"
      title="Nova recolha"
      description={dataset.name}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="submit-record" icon={Send} loading={submit.isPending}>
            Submeter
          </Button>
        </>
      }
    >
      <SubmitRecordBody schema={dataset.schema} projectId={projectId} error={submit.error} onSubmit={send} />
    </Modal>
  );
}

function SubmitRecordBody({
  schema,
  projectId,
  error,
  onSubmit,
}: {
  schema: DatasetSchema;
  projectId: string;
  error: ApiError | null;
  onSubmit: (b: SubmitBody) => void;
}) {
  const fields = schemaFields(schema, true);
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outlet, setOutlet] = useState<{ id: string; name: string } | null>(null);
  const [gps, setGps] = useState<GpsFix | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { values, errors: local } = collect(schema, drafts, fields.map((f) => f.key));
    setErrors(local);
    if (Object.keys(local).length) return;
    const data = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
    onSubmit({
      data,
      outletId: outlet?.id,
      gpsLat: gps?.lat,
      gpsLng: gps?.lng,
    });
  };

  return (
    <form id="submit-record" onSubmit={submit} noValidate>
      <ApiErrors error={error} />
      {fields.length ? (
        <div className="flex flex-col gap-4">
          {fields.map((f) => (
            <FieldInput
              key={f.key}
              label={f.label}
              type={f.type}
              value={drafts[f.key] ?? (f.type === 'boolean' ? null : '')}
              onChange={(v) => setDrafts((d) => ({ ...d, [f.key]: v }))}
              error={errors[f.key]}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-3">Este formulário não tem perguntas ativas.</p>
      )}
      <div className="mt-5 grid gap-3">
        <OutletPicker projectId={projectId} value={outlet} onChange={setOutlet} />
        <GpsCapture value={gps} onChange={setGps} />
      </div>
    </form>
  );
}

/* ───────────────────────── Corrigir registo ───────────────────────── */

interface UpdateBody {
  data: Record<string, unknown>;
  reason: string;
  lastKnownUpdatedAt?: string;
}

export function EditRecordModal({
  record,
  datasetId,
  schema,
  onClose,
}: {
  /** Registo a corrigir (lido da lista atual: muda quando a lista é recarregada). */
  record: DataRecord | null;
  datasetId: string;
  schema: DatasetSchema;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [conflict, setConflict] = useState<string | null>(null);
  const update = useApiMutation(
    (body: UpdateBody & { recordId: string }) => {
      const { recordId, ...rest } = body;
      return api<DataRecord>(`/datasets/${datasetId}/records/${recordId}`, { method: 'PATCH', body: rest });
    },
    { invalidate: [['dataset-records', datasetId], ['record-history']] },
  );
  const close = () => {
    update.reset();
    setConflict(null);
    onClose();
  };
  const onSubmit = (body: UpdateBody) => {
    if (!record) return;
    setConflict(null);
    update.mutate(
      { ...body, recordId: record.id },
      {
        onSuccess: () => {
          toast.success('Registo corrigido', 'A alteração ficou registada no histórico.');
          close();
        },
        onError: (e) => {
          if (e.status === 409) {
            setConflict(e.message);
            update.reset();
            void qc.invalidateQueries({ queryKey: ['dataset-records', datasetId] });
            toast.warn('O registo mudou entretanto', 'Carregámos a versão mais recente. Reveja e grave de novo.');
          }
        },
      },
    );
  };
  return (
    <Modal
      open={!!record}
      onClose={close}
      module="dados"
      size="lg"
      title={record ? `Corrigir registo #${record.seq}` : 'Corrigir registo'}
      description="Altere apenas o que está errado. Quem corrige, quando e porquê fica no histórico."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="edit-record" icon={Save} loading={update.isPending}>
            Guardar correção
          </Button>
        </>
      }
    >
      <AnimatePresence>
        {conflict ? (
          <motion.div
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden rounded-2xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn"
          >
            <p className="flex items-center gap-2 font-bold">
              <AlertTriangle className="size-4 shrink-0" aria-hidden /> Outra pessoa alterou este registo
            </p>
            <p className="mt-1 text-[13px] text-ink-2">{conflict} Os campos abaixo já mostram a versão mais recente.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {record ? (
        // A chave muda quando chega uma versão nova do registo: os campos recomeçam com os valores atuais.
        <EditRecordBody key={`${record.id}-${record.updatedAt ?? 'orig'}`} record={record} schema={schema} error={update.error} onSubmit={onSubmit} />
      ) : null}
    </Modal>
  );
}

function EditRecordBody({
  record,
  schema,
  error,
  onSubmit,
}: {
  record: DataRecord;
  schema: DatasetSchema;
  error: ApiError | null;
  onSubmit: (b: UpdateBody) => void;
}) {
  const fields = schemaFields(schema, true);
  const [initial] = useState<Record<string, DraftValue>>(() => Object.fromEntries(fields.map((f) => [f.key, toDraft(record.data[f.key], f.type)])));
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>(initial);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);

  const changedKeys = fields.map((f) => f.key).filter((k) => (drafts[k] ?? null) !== (initial[k] ?? null));
  const reasonError = tried && !reason.trim() ? 'Indique o motivo da correção.' : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    const { values, errors: local } = collect(schema, drafts, changedKeys);
    setErrors(local);
    if (Object.keys(local).length || !reason.trim() || !changedKeys.length) return;
    // Campo apagado → null (a API limpa o valor).
    const data = Object.fromEntries(changedKeys.map((k) => [k, values[k] === undefined ? null : values[k]]));
    onSubmit({ data, reason: reason.trim(), lastKnownUpdatedAt: record.updatedAt ?? undefined });
  };

  return (
    <form id="edit-record" onSubmit={submit} noValidate>
      <ApiErrors error={error && error.status !== 409 ? error : null} />
      <div className="flex flex-col gap-4">
        {fields.map((f) => {
          const changed = changedKeys.includes(f.key);
          return (
            <div key={f.key} className={changed ? 'rounded-2xl bg-[var(--accent-soft)] p-3 ring-1 ring-[var(--accent)]/30 transition-colors' : 'px-0 transition-colors'}>
              <FieldInput
                label={f.label}
                type={f.type}
                value={drafts[f.key] ?? null}
                onChange={(v) => setDrafts((d) => ({ ...d, [f.key]: v }))}
                error={errors[f.key]}
                hint={changed ? 'Alterado' : undefined}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-5">
        <Field label="Motivo da correção" required error={reasonError} hint="Ex.: preço mal digitado, confirmado por fotografia.">
          {(a) => <Textarea {...a} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="min-h-20" />}
        </Field>
      </div>
      {tried && !changedKeys.length ? (
        <p className="mt-3 text-sm font-medium text-warn" role="status">
          Ainda não alterou nenhum campo.
        </p>
      ) : null}
    </form>
  );
}
