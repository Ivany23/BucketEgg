'use client';

import { ArrowLeftRight, Building2, CheckCircle2, FolderKanban, Plus, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { RoleBadge } from '@/components/domain';
import { BRANCH_COLORS } from '@/components/org/roles';
import { SettingsSection } from '@/components/org/section';
import { Badge, Button, EmptyState, ErrorState, Field, Input, ListSkeleton, Modal, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { int } from '@/lib/format';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Organization, Role } from '@/lib/types';

type CreateOrganizationBody = components['schemas']['CreateOrganizationDto'];
type MyOrganization = Organization & { memberships: { role: Role }[] };
interface CreatedOrganization {
  organization: Organization;
  session?: { access_token: string };
}

export function OrganizationsTab() {
  const { me, organizationId, switchOrganization } = useSession();
  const toast = useToast();
  const reduce = useReducedMotion();
  const q = useApi<MyOrganization[]>(['organizations', me?.id], me ? '/organizations' : null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const switchTo = async (org: MyOrganization) => {
    setSwitching(org.id);
    try {
      await switchOrganization(org.id);
      toast.success('Organização alterada', `Está agora a trabalhar em ${org.name}.`);
    } catch (e) {
      toast.error('Não foi possível mudar de organização', (e as Error).message);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <SettingsSection
      icon={ArrowLeftRight}
      title="As minhas organizações"
      description="Empresas ou distribuidores a que pertence. Os dados de cada organização ficam sempre separados."
      color="var(--m-rotas)"
      aside={
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => setCreating(true)} className="hidden sm:inline-flex">
          Criar nova organização
        </Button>
      }
    >
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <ListSkeleton rows={2} />
      ) : q.data.length === 0 ? (
        <EmptyState compact illustration="egg" title="Ainda não pertence a nenhuma organização" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {q.data.map((org, i) => {
            const active = org.id === organizationId;
            const color = BRANCH_COLORS[(i + 1) % BRANCH_COLORS.length];
            const role = org.memberships[0]?.role;
            return (
              <motion.li
                key={org.id}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.05, type: 'spring', stiffness: 280, damping: 26 }}
                className="flex flex-col gap-3 rounded-2xl border p-4"
                style={
                  active
                    ? { borderColor: 'transparent', boxShadow: `0 0 0 2px var(--ok)`, background: 'color-mix(in oklab, var(--ok) 6%, var(--surface))' }
                    : { borderColor: 'var(--border)' }
                }
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-[#1a1208]"
                    style={{ background: `color-mix(in oklab, ${color} 80%, white)` }}
                  >
                    <Building2 className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-ink">{org.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {role ? <RoleBadge role={role} /> : null}
                      {active ? (
                        <Badge tone="ok" icon={CheckCircle2}>
                          Ativa
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
                  <span className="inline-flex items-center gap-1">
                    <FolderKanban className="size-3.5 text-[var(--m-painel)]" aria-hidden /> {int(org._count?.projects)} projetos
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5 text-[var(--m-equipa)]" aria-hidden /> {int(org._count?.memberships)} membros
                  </span>
                  <span>{org.currency}</span>
                  <span className="flex-1" />
                  {active ? (
                    <span className="font-semibold text-ok">Em uso</span>
                  ) : (
                    <Button size="sm" variant="soft" icon={ArrowLeftRight} loading={switching === org.id} disabled={!!switching} onClick={() => switchTo(org)}>
                      Mudar para esta
                    </Button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
      <Button variant="secondary" icon={Plus} onClick={() => setCreating(true)} className="mt-4 w-full sm:hidden">
        Criar nova organização
      </Button>
      <CreateOrganizationModal open={creating} onClose={() => setCreating(false)} />
    </SettingsSection>
  );
}

function CreateOrganizationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      module="config"
      size="sm"
      title="Criar nova organização"
      description="Fica como dono da nova organização e passa a trabalhar nela de imediato. A organização atual continua disponível."
    >
      <CreateOrganizationForm onClose={onClose} />
    </Modal>
  );
}

function CreateOrganizationForm({ onClose }: { onClose: () => void }) {
  const { adoptToken, switchOrganization } = useSession();
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2 || n.length > 120) {
      setError('O nome deve ter entre 2 e 120 caracteres.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body: CreateOrganizationBody = { name: n, currency: 'MZN', timezone: 'Africa/Maputo' };
      // A API devolve { organization, session } — o token da sessão já abre a nova organização.
      const res = await api<CreatedOrganization>('/organizations', { method: 'POST', body });
      if (res.session?.access_token) await adoptToken(res.session.access_token);
      else await switchOrganization(res.organization.id);
      toast.success('Organização criada', `Bem-vindo(a) a ${res.organization.name}. Crie o primeiro projeto para começar.`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Nome da organização" required error={error} hint="Pode mudar a moeda, o fuso horário e o geofence depois, nas definições.">
        {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Distribuidora Matola" maxLength={120} />}
      </Field>
      <div className="-mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" icon={Plus} loading={busy}>
          Criar organização
        </Button>
      </div>
    </form>
  );
}
