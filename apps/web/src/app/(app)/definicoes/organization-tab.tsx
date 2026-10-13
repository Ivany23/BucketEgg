'use client';

import { Building2, FolderKanban, Lock, MapPin, Package, Save, Store, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { SettingsSection } from '@/components/org/section';
import { Button, ErrorState, Field, Input, Select, Skeleton, StatTile, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { date } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Organization } from '@/lib/types';

type UpdateOrganizationBody = components['schemas']['UpdateOrganizationDto'];

export const TIMEZONES: { id: string; label: string }[] = [
  { id: 'Africa/Maputo', label: 'Maputo (CAT, UTC+2)' },
  { id: 'Africa/Johannesburg', label: 'Joanesburgo (SAST, UTC+2)' },
  { id: 'Africa/Harare', label: 'Harare (CAT, UTC+2)' },
  { id: 'Africa/Luanda', label: 'Luanda (WAT, UTC+1)' },
  { id: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { id: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam (EAT, UTC+3)' },
  { id: 'Europe/Lisbon', label: 'Lisboa (WET/WEST)' },
  { id: 'America/Sao_Paulo', label: 'São Paulo (BRT, UTC−3)' },
  { id: 'UTC', label: 'UTC' },
];

const CURRENCIES: { id: string; label: string }[] = [
  { id: 'MZN', label: 'MZN — Metical moçambicano' },
  { id: 'ZAR', label: 'ZAR — Rand sul-africano' },
  { id: 'USD', label: 'USD — Dólar americano' },
  { id: 'EUR', label: 'EUR — Euro' },
  { id: 'AOA', label: 'AOA — Kwanza angolano' },
  { id: 'MWK', label: 'MWK — Kwacha do Malawi' },
];

export const radiusLabel = (m: number) =>
  m >= 1000 ? `${(m / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} km` : `${m.toLocaleString('pt-PT')} m`;

export function OrganizationTab() {
  const { organizationId } = useSession();
  const q = useApi<Organization>(['organization', organizationId], organizationId ? '/organizations/current' : null);
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="A carregar a organização">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  const org = q.data;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile index={0} label="Projetos" value={org._count?.projects ?? 0} icon={FolderKanban} color="var(--m-painel)" />
        <StatTile index={1} label="Membros" value={org._count?.memberships ?? 0} icon={Users} color="var(--m-equipa)" />
        <StatTile index={2} label="Produtos" value={org._count?.products ?? 0} icon={Package} color="var(--m-produtos)" />
      </div>
      <OrganizationForm key={org.updatedAt} org={org} />
    </div>
  );
}

function OrganizationForm({ org }: { org: Organization }) {
  const { isAdmin } = useSession();
  const toast = useToast();
  const [name, setName] = useState(org.name);
  const [currency, setCurrency] = useState(org.currency);
  const [timezone, setTimezone] = useState(org.timezone);
  const [radius, setRadius] = useState(org.geofenceRadiusM);
  const [errors, setErrors] = useState<{ name?: string; form?: string }>({});

  const save = useApiMutation((body: UpdateOrganizationBody) => api<Organization>('/organizations/current', { method: 'PATCH', body }), {
    invalidate: [['organization'], ['organizations'], ['me']],
    onSuccess: () => toast.success('Organização atualizada'),
    onError: (e) => setErrors({ form: e.message }),
  });

  const dirty = name.trim() !== org.name || currency !== org.currency || timezone !== org.timezone || radius !== org.geofenceRadiusM;
  const currencies = CURRENCIES.some((c) => c.id === org.currency) ? CURRENCIES : [{ id: org.currency, label: org.currency }, ...CURRENCIES];
  const zones = TIMEZONES.some((t) => t.id === org.timezone) ? TIMEZONES : [{ id: org.timezone, label: org.timezone }, ...TIMEZONES];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2 || n.length > 120) {
      setErrors({ name: 'O nome deve ter entre 2 e 120 caracteres.' });
      return;
    }
    setErrors({});
    const body: UpdateOrganizationBody = {};
    if (n !== org.name) body.name = n;
    if (currency !== org.currency) body.currency = currency;
    if (timezone !== org.timezone) body.timezone = timezone;
    if (radius !== org.geofenceRadiusM) body.geofenceRadiusM = radius;
    save.mutate(body);
  };

  if (!isAdmin) {
    return (
      <SettingsSection
        icon={Building2}
        title="Definições da organização"
        description="Só donos e administradores podem alterar estas definições."
        aside={<Lock className="size-4 text-ink-3" aria-label="Só leitura" />}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReadItem label="Nome" value={org.name} />
          <ReadItem label="Moeda" value={currencies.find((c) => c.id === org.currency)?.label ?? org.currency} />
          <ReadItem label="Fuso horário" value={zones.find((t) => t.id === org.timezone)?.label ?? org.timezone} />
          <ReadItem label="Raio de check-in (geofence)" value={radiusLabel(org.geofenceRadiusM)} />
          <ReadItem label="Identificador" value={org.slug} />
          <ReadItem label="Criada a" value={date(org.createdAt)} />
        </dl>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection icon={Building2} title="Definições da organização" description={`Identificador: ${org.slug} · criada a ${date(org.createdAt)}`}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {errors.form ? (
          <p role="alert" className="rounded-xl border border-bad/40 bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad">
            {errors.form}
          </p>
        ) : null}
        <Field label="Nome da organização" required error={errors.name}>
          {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Moeda" hint="Usada nos preços, encomendas e cobranças.">
            {(a) => (
              <Select {...a} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Fuso horário" hint="Define o “dia” das rotas e do meu dia.">
            {(a) => (
              <Select {...a} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {zones.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <GeofenceSlider value={radius} onChange={setRadius} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button
            variant="ghost"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setName(org.name);
              setCurrency(org.currency);
              setTimezone(org.timezone);
              setRadius(org.geofenceRadiusM);
              setErrors({});
            }}
          >
            Repor
          </Button>
          <Button type="submit" variant="primary" icon={Save} loading={save.isPending} disabled={!dirty}>
            Guardar
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

function ReadItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-xs font-semibold text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

const MIN = 10;
const MAX = 5000;

function GeofenceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const reduce = useReducedMotion();
  const pctValue = ((value - MIN) / (MAX - MIN)) * 100;
  // Escala logarítmica para o desenho (10 m e 5 km ainda se distinguem).
  const scale = 0.25 + (0.75 * Math.log(value / MIN)) / Math.log(MAX / MIN);
  const step = value < 200 ? 5 : value < 1000 ? 10 : 50;
  return (
    <div className="grid gap-4 rounded-2xl border border-line p-4 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-center">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="geofence" className="text-[13px] font-semibold text-ink-2">
            Raio de check-in (geofence)
          </label>
          <output htmlFor="geofence" className="text-xl font-extrabold text-ink tabular-nums">
            {radiusLabel(value)}
          </output>
        </div>
        <input
          id="geofence"
          type="range"
          min={MIN}
          max={MAX}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={radiusLabel(value)}
          aria-describedby="geofence-hint"
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--m-lojas)]"
          style={{ background: `linear-gradient(90deg, var(--m-lojas) ${pctValue}%, var(--surface-3) ${pctValue}%)` }}
        />
        <div className="mt-1 flex justify-between text-[11px] text-ink-3">
          <span>10 m</span>
          <span>5 km</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[50, 100, 150, 300, 500].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-pressed={value === v}
              className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink-2 hover:border-line-strong aria-pressed:border-transparent aria-pressed:bg-[var(--m-lojas-soft)] aria-pressed:text-[var(--m-lojas-text)]"
            >
              {radiusLabel(v)}
            </button>
          ))}
        </div>
        <p id="geofence-hint" className="mt-2 text-xs text-ink-3">
          Check-ins mais longe da loja do que este raio são aceites, mas ficam marcados como “fora do local”. Em Maputo, 100–200 m funciona bem.
        </p>
      </div>
      <div aria-hidden className="relative mx-auto flex size-32 items-center justify-center overflow-hidden rounded-2xl bg-surface-2">
        <span className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(var(--border-strong) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
        <motion.span
          className="absolute size-28 rounded-full border-2"
          style={{ borderColor: 'var(--m-lojas)', background: 'color-mix(in oklab, var(--m-lojas) 18%, transparent)' }}
          animate={{ scale }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
        />
        <span className="relative inline-flex size-7 items-center justify-center rounded-full bg-[var(--m-lojas)] text-[#0b1f1c] shadow-soft">
          <Store className="size-3.5" />
        </span>
        <MapPin className="absolute top-3 right-4 size-4 text-[var(--m-rotas)]" />
      </div>
    </div>
  );
}
