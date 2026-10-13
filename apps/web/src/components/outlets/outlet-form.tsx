'use client';

import { AlertTriangle, ArrowLeft, Crosshair, Hourglass, MapPinned, Plus, Save, Store } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Field, Input, Modal, Select, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import { OUTLET_STATUS_LABEL, type Outlet, type OutletStatus } from '@/lib/types';
import { useOutletFacets } from './all-tab';
import { DEMO_LOGIN, useGeolocation } from './meta';

type CreateBody = components['schemas']['CreateOutletDto'];
/** No PATCH, `null` limpa o campo (a API aceita null nos campos opcionais). */
type UpdateBody = { [K in keyof components['schemas']['UpdateOutletDto']]?: components['schemas']['UpdateOutletDto'][K] | null };

interface DuplicateCandidate {
  id: string;
  name: string;
  reasons: string[];
}

interface FormState {
  name: string;
  code: string;
  address: string;
  phone: string;
  contactName: string;
  channel: string;
  outletClass: string;
  visitFrequencyDays: string;
  latitude: string;
  longitude: string;
  zone: string;
  creditLimit: string;
  potentialScore: string;
  status: OutletStatus;
}

const blank: FormState = {
  name: '',
  code: '',
  address: '',
  phone: '',
  contactName: '',
  channel: '',
  outletClass: '',
  visitFrequencyDays: '7',
  latitude: '',
  longitude: '',
  zone: '',
  creditLimit: '',
  potentialScore: '',
  status: 'ACTIVE',
};

const fromOutlet = (o: Outlet): FormState => ({
  name: o.name,
  code: o.code ?? '',
  address: o.address ?? '',
  phone: o.phone ?? '',
  contactName: o.contactName ?? '',
  channel: o.channel ?? '',
  outletClass: o.outletClass ?? '',
  visitFrequencyDays: String(o.visitFrequencyDays),
  latitude: o.latitude != null ? String(o.latitude) : '',
  longitude: o.longitude != null ? String(o.longitude) : '',
  zone: o.zone ?? '',
  creditLimit: String(o.creditLimit ?? 0),
  potentialScore: String(o.potentialScore ?? 0),
  status: o.status,
});

type Errors = Partial<Record<keyof FormState, string>>;

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = 'Indique o nome da loja (mínimo 2 caracteres).';
  const freq = num(f.visitFrequencyDays);
  if (freq === undefined || !Number.isInteger(freq) || freq < 1 || freq > 365) e.visitFrequencyDays = 'Entre 1 e 365 dias.';
  const lat = num(f.latitude);
  const lng = num(f.longitude);
  if ((lat === undefined) !== (lng === undefined)) {
    if (lat === undefined) e.latitude = 'Indique também a latitude.';
    else e.longitude = 'Indique também a longitude.';
  }
  if (lat !== undefined && (Number.isNaN(lat) || lat < -90 || lat > 90)) e.latitude = 'Latitude inválida (−90 a 90).';
  if (lng !== undefined && (Number.isNaN(lng) || lng < -180 || lng > 180)) e.longitude = 'Longitude inválida (−180 a 180).';
  const credit = num(f.creditLimit);
  if (credit !== undefined && (Number.isNaN(credit) || credit < 0)) e.creditLimit = 'Valor igual ou superior a 0.';
  const pot = num(f.potentialScore);
  if (pot !== undefined && (Number.isNaN(pot) || pot < 0 || pot > 100)) e.potentialScore = 'Entre 0 e 100.';
  return e;
}

function toCreateBody(f: FormState): CreateBody {
  const text = (s: string) => s.trim() || undefined;
  return {
    name: f.name.trim(),
    code: text(f.code),
    address: text(f.address),
    phone: text(f.phone),
    contactName: text(f.contactName),
    channel: text(f.channel),
    outletClass: text(f.outletClass),
    visitFrequencyDays: num(f.visitFrequencyDays),
    latitude: num(f.latitude),
    longitude: num(f.longitude),
    zone: text(f.zone),
    creditLimit: num(f.creditLimit),
    potentialScore: num(f.potentialScore),
  };
}

function toUpdateBody(f: FormState): UpdateBody {
  const text = (s: string) => s.trim() || null;
  return {
    name: f.name.trim(),
    code: text(f.code),
    address: text(f.address),
    phone: text(f.phone),
    contactName: text(f.contactName),
    channel: text(f.channel),
    outletClass: text(f.outletClass),
    visitFrequencyDays: num(f.visitFrequencyDays),
    latitude: num(f.latitude) ?? null,
    longitude: num(f.longitude) ?? null,
    zone: text(f.zone),
    creditLimit: num(f.creditLimit) ?? 0,
    potentialScore: num(f.potentialScore) ?? 0,
    status: f.status,
  };
}

/* ───────────────────────────── Campos partilhados ───────────────────────────── */

function OutletFields({
  projectId,
  form,
  errors,
  set,
  showStatus,
}: {
  projectId: string;
  form: FormState;
  errors: Errors;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  showStatus?: boolean;
}) {
  const facets = useOutletFacets(projectId);
  const geo = useGeolocation();
  const zonesId = useId();
  const channelsId = useId();

  const locate = async () => {
    const p = await geo.request();
    if (p) {
      set('latitude', p.lat.toFixed(6));
      set('longitude', p.lng.toFixed(6));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Section title="Identificação" color="var(--m-lojas)">
        <Field label="Nome da loja" required error={errors.name} className="sm:col-span-2">
          {(a) => <Input {...a} value={form.name} maxLength={160} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Mercearia Central" autoComplete="off" />}
        </Field>
        <Field label="Código" hint="Código do ERP, se existir.">
          {(a) => <Input {...a} value={form.code} maxLength={60} onChange={(e) => set('code', e.target.value)} placeholder="MPT-0001" />}
        </Field>
        <Field label="Canal">
          {(a) => (
            <>
              <Input {...a} list={channelsId} value={form.channel} maxLength={40} onChange={(e) => set('channel', e.target.value)} placeholder="Mercearia, Bar…" />
              <datalist id={channelsId}>
                {facets.channels.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Classe">
          {(a) => (
            <Select {...a} value={form.outletClass} onChange={(e) => set('outletClass', e.target.value)}>
              <option value="">Sem classe</option>
              {facets.classes.map((c) => (
                <option key={c} value={c}>
                  Classe {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {showStatus ? (
          <Field label="Estado">
            {(a) => (
              <Select {...a} value={form.status} onChange={(e) => set('status', e.target.value as OutletStatus)}>
                {(Object.keys(OUTLET_STATUS_LABEL) as OutletStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {OUTLET_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </Section>

      <Section title="Contacto" color="var(--m-rotas)">
        <Field label="Pessoa de contacto">
          {(a) => <Input {...a} value={form.contactName} maxLength={120} onChange={(e) => set('contactName', e.target.value)} placeholder="Sr. Mussa" />}
        </Field>
        <Field label="Telefone">
          {(a) => (
            <Input {...a} type="tel" inputMode="tel" value={form.phone} maxLength={30} onChange={(e) => set('phone', e.target.value)} placeholder="+258 84 000 0000" autoComplete="off" />
          )}
        </Field>
      </Section>

      <Section title="Localização" color="var(--m-visitas)">
        <Field label="Morada" className="sm:col-span-2">
          {(a) => <Input {...a} value={form.address} maxLength={300} onChange={(e) => set('address', e.target.value)} placeholder="Av. 24 de Julho, 123, Maputo" />}
        </Field>
        <Field label="Zona">
          {(a) => (
            <>
              <Input {...a} list={zonesId} value={form.zone} maxLength={80} onChange={(e) => set('zone', e.target.value)} placeholder="KaMpfumo" />
              <datalist id={zonesId}>
                {facets.zones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <div className="flex flex-col justify-end gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" icon={Crosshair} loading={geo.loading} onClick={() => void locate()}>
              Usar a minha localização
            </Button>
            {DEMO_LOGIN ? (
              <Button
                size="sm"
                variant="ghost"
                icon={MapPinned}
                onClick={() => {
                  set('latitude', '-25.969200');
                  set('longitude', '32.573200');
                }}
              >
                Baixa (demo)
              </Button>
            ) : null}
          </div>
          {geo.error ? (
            <p role="alert" className="text-xs font-medium text-bad">
              {geo.error}
            </p>
          ) : null}
        </div>
        <Field label="Latitude" error={errors.latitude}>
          {(a) => <Input {...a} inputMode="decimal" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="-25.9692" />}
        </Field>
        <Field label="Longitude" error={errors.longitude}>
          {(a) => <Input {...a} inputMode="decimal" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="32.5732" />}
        </Field>
      </Section>

      <Section title="Comercial" color="var(--m-vendas)">
        <Field label="Frequência de visita (dias)" required error={errors.visitFrequencyDays}>
          {(a) => (
            <Input {...a} type="number" min={1} max={365} step={1} value={form.visitFrequencyDays} onChange={(e) => set('visitFrequencyDays', e.target.value)} />
          )}
        </Field>
        <Field label="Limite de crédito (MZN)" error={errors.creditLimit}>
          {(a) => <Input {...a} type="number" min={0} step="any" inputMode="decimal" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} placeholder="0" />}
        </Field>
        <Field label="Potencial (0–100)" error={errors.potentialScore} hint="Pesa na prioridade das visitas em atraso.">
          {(a) => <Input {...a} type="number" min={0} max={100} step="any" value={form.potentialScore} onChange={(e) => set('potentialScore', e.target.value)} placeholder="50" />}
        </Field>
      </Section>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 inline-flex items-center gap-2 text-xs font-bold tracking-wide text-ink-2 uppercase">
        <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
        {title}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function useFormState(initial: FormState) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const check = () => {
    const e = validate(form);
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  return { form, setForm, errors, set, check };
}

/* ───────────────────────────── Criar ───────────────────────────── */

export function CreateOutletModal({
  projectId,
  open,
  onClose,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (o: Outlet) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova loja"
      description="Registe um cliente para o incluir em rotas, visitas e encomendas."
      size="lg"
      module="lojas"
    >
      {/* Montado só quando aberto: o formulário começa sempre limpo. */}
      <CreateOutletForm projectId={projectId} onClose={onClose} onCreated={onCreated} />
    </Modal>
  );
}

function CreateOutletForm({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated?: (o: Outlet) => void }) {
  const toast = useToast();
  const { isFieldRep, isManager } = useSession();
  const { form, errors, set, check } = useFormState(blank);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [checking, setChecking] = useState(false);

  const create = useApiMutation(
    (body: CreateBody) => api<Outlet>(`/projects/${projectId}/outlets`, { method: 'POST', body }),
    {
      invalidate: [['outlets'], ['dashboard']],
      onSuccess: (o) => {
        if (o.status === 'PENDING_APPROVAL') toast.info('Loja enviada para aprovação', `${o.name} fica a aguardar a revisão de um supervisor.`);
        else toast.success('Loja criada', o.name);
        onCreated?.(o);
        onClose();
      },
      onError: (e) => {
        const dup = e instanceof ApiError && e.status === 409 ? (e.body as { duplicates?: DuplicateCandidate[] } | null)?.duplicates : undefined;
        if (dup?.length) setDuplicates(dup);
        else toast.error('Não foi possível criar a loja', e.message);
      },
    },
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!check()) return;
    const body = toCreateBody(form);
    setChecking(true);
    try {
      const found = await api<DuplicateCandidate[]>(`/projects/${projectId}/outlets/check-duplicates`, { method: 'POST', body });
      if (found.length) {
        setDuplicates(found);
        return;
      }
    } catch (err) {
      toast.error('Não foi possível verificar duplicados', err instanceof Error ? err.message : undefined);
      return;
    } finally {
      setChecking(false);
    }
    create.mutate(body);
  };

  const formId = useId();

  return (
    <div className="flex flex-col gap-5">
      {isFieldRep || !isManager ? (
        <p className="flex items-start gap-2 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
          <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>A loja fica &quot;A aguardar aprovação&quot;</strong> até um supervisor a confirmar. Depois de aprovada aparece em todas as listas e pode entrar em rotas.
          </span>
        </p>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {duplicates ? (
          <motion.div
            key="dups"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="flex flex-col gap-4"
          >
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
              <div>
                <p className="font-bold text-ink">Possíveis duplicados</p>
                <p className="mt-0.5 text-sm text-ink-2">
                  Já existe {duplicates.length === 1 ? 'uma loja parecida' : `${duplicates.length} lojas parecidas`} neste projeto. Confirme que &quot;{form.name.trim()}&quot; é mesmo
                  outra loja.
                </p>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {duplicates.map((d, i) => (
                <motion.li
                  key={d.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5"
                >
                  <Store className="size-4 shrink-0 text-[var(--accent-text)]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{d.name}</span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {d.reasons.map((r) => (
                      <span key={r} className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
                        {r}
                      </span>
                    ))}
                  </span>
                </motion.li>
              ))}
            </ul>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setDuplicates(null)} disabled={create.isPending}>
                Voltar e corrigir
              </Button>
              <Button variant="primary" icon={Plus} loading={create.isPending} onClick={() => create.mutate({ ...toCreateBody(form), force: true })}>
                Criar mesmo assim
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            id={formId}
            noValidate
            onSubmit={(e) => void submit(e)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="flex flex-col gap-5"
          >
            <OutletFields projectId={projectId} form={form} errors={errors} set={set} />
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" icon={Plus} loading={checking || create.isPending}>
                {isManager ? 'Criar loja' : 'Enviar para aprovação'}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────────── Editar ───────────────────────────── */

export function EditOutletModal({ outlet, open, onClose }: { outlet: Outlet | null; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open && !!outlet} onClose={onClose} title="Editar loja" description={outlet?.name} size="lg" module="lojas">
      {outlet ? <EditOutletForm key={outlet.id + outlet.updatedAt} outlet={outlet} onClose={onClose} /> : null}
    </Modal>
  );
}

function EditOutletForm({ outlet, onClose }: { outlet: Outlet; onClose: () => void }) {
  const toast = useToast();
  const { form, errors, set, check } = useFormState(fromOutlet(outlet));
  const update = useApiMutation(
    (body: UpdateBody) => api<Outlet>(`/outlets/${outlet.id}`, { method: 'PATCH', body }),
    {
      invalidate: [['outlets'], ['outlet'], ['dashboard']],
      onSuccess: (o) => {
        toast.success('Loja atualizada', o.name);
        onClose();
      },
      onError: (e) => toast.error('Não foi possível guardar', e.message),
    },
  );
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (check()) update.mutate(toUpdateBody(form));
      }}
      className="flex flex-col gap-5"
    >
      <OutletFields projectId={outlet.projectId} form={form} errors={errors} set={set} showStatus />
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" icon={Save} loading={update.isPending}>
          Guardar alterações
        </Button>
      </div>
    </form>
  );
}
