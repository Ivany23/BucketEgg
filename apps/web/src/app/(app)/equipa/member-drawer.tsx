'use client';

import { AlertTriangle, CalendarDays, Lock, Mail, Phone, Save, UserMinus, Users } from 'lucide-react';
import { useState } from 'react';
import { RoleBadge } from '@/components/domain';
import { Avatar, Badge, Button, Drawer, Switch, useConfirm, useToast } from '@/components/ui';
import { ROLE_META, RolePicker, SUPERVISOR_ROLES, assignableRoles, canManageRole, displayName } from '@/components/org/roles';
import { SupervisorPicker } from '@/components/org/supervisor-picker';
import { api } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { date } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import { ROLE_LABEL, type Member, type Role } from '@/lib/types';

type UpdateMemberBody = components['schemas']['UpdateMemberDto'];

export function MemberDrawer({
  member,
  members,
  colors,
  onClose,
}: {
  member: Member | null;
  members: Member[];
  colors: Map<string, string>;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={!!member}
      onClose={onClose}
      module="equipa"
      title={member ? displayName(member.user) : ''}
      subtitle={member ? member.user.email : undefined}
    >
      {/* Remonta o formulário ao trocar de membro (estado inicial = valores atuais). */}
      {member ? <MemberDetail key={member.id} member={member} members={members} colors={colors} onClose={onClose} /> : null}
    </Drawer>
  );
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function MemberDetail({ member, members, colors, onClose }: { member: Member; members: Member[]; colors: Map<string, string>; onClose: () => void }) {
  const { role: myRole, me } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const isSelf = member.user.id === me?.id;
  const canEdit = !isSelf && canManageRole(myRole, member.role);
  const roles = assignableRoles(myRole);

  const initialSupervisors = member.supervisors.map((s) => s.id);
  const [role, setRole] = useState<Role>(member.role);
  const [supervisorIds, setSupervisorIds] = useState<string[]>(initialSupervisors);
  const [isActive, setIsActive] = useState(member.isActive);
  const [error, setError] = useState<string | null>(null);

  // Não pode ser supervisor de si próprio nem de quem já supervisiona (a API recusa ciclos diretos).
  const supervisedIds = new Set(member.supervising.map((s) => s.id));
  const supervisorOptions = members.filter(
    (m) => m.isActive && SUPERVISOR_ROLES.includes(m.role) && m.id !== member.id && !supervisedIds.has(m.id),
  );

  const dirty = role !== member.role || isActive !== member.isActive || !sameSet(supervisorIds, initialSupervisors);
  const losesTeam = member.supervising.length > 0 && (!SUPERVISOR_ROLES.includes(role) || !isActive);

  const update = useApiMutation(
    (body: UpdateMemberBody) => api<Member>(`/team/${member.id}`, { method: 'PATCH', body }),
    {
      invalidate: [['team']],
      onSuccess: () => {
        setError(null);
        toast.success('Alterações guardadas', displayName(member.user));
      },
      onError: (e) => setError(e.message),
    },
  );
  const deactivate = useApiMutation(() => api<Member>(`/team/${member.id}`, { method: 'DELETE' }), {
    invalidate: [['team']],
    onSuccess: () => {
      toast.success('Membro desativado', 'O histórico de visitas, encomendas e registos fica preservado.');
      onClose();
    },
    onError: (e) => toast.error('Não foi possível desativar', e.message),
  });

  const save = () => {
    const body: UpdateMemberBody = {};
    if (role !== member.role) body.role = role;
    if (!sameSet(supervisorIds, initialSupervisors)) body.supervisorIds = supervisorIds;
    if (isActive !== member.isActive) body.isActive = isActive;
    update.mutate(body);
  };

  const askDeactivate = async () => {
    const ok = await confirm({
      title: `Desativar ${displayName(member.user)}?`,
      description:
        'A pessoa deixa de conseguir entrar nesta organização. As visitas, encomendas e registos que fez continuam guardados, e pode reativá-la mais tarde.',
      confirmLabel: 'Desativar',
      danger: true,
    });
    if (ok) deactivate.mutate();
  };

  const meta = ROLE_META[member.role];
  // Garante que o papel atual aparece na escolha mesmo que já não o possa atribuir.
  const pickerRoles = roles.includes(member.role) ? roles : [member.role, ...roles];

  return (
    <div className="flex flex-col gap-6">
      <section
        className="relative overflow-hidden rounded-2xl p-4"
        style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${meta.color} 18%, var(--surface)), var(--surface-2))` }}
      >
        <div className="flex items-center gap-4">
          <Avatar name={member.user.name} email={member.user.email} size={60} />
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <RoleBadge role={member.role} />
              {member.isActive ? <Badge tone="ok">Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>}
              {isSelf ? <Badge tone="info">Você</Badge> : null}
            </div>
            <dl className="mt-2 space-y-1 text-sm text-ink-2">
              <div className="flex items-center gap-2">
                <dt className="sr-only">Email</dt>
                <Mail className="size-4 text-ink-3" aria-hidden />
                <dd className="truncate">
                  <a href={`mailto:${member.user.email}`} className="hover:underline">
                    {member.user.email}
                  </a>
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="sr-only">Telefone</dt>
                <Phone className="size-4 text-ink-3" aria-hidden />
                <dd>
                  {member.user.phone ? (
                    <a href={`tel:${member.user.phone.replace(/\s/g, '')}`} className="hover:underline">
                      {member.user.phone}
                    </a>
                  ) : (
                    <span className="text-ink-3">Sem telefone</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="sr-only">Membro desde</dt>
                <CalendarDays className="size-4 text-ink-3" aria-hidden />
                <dd>Membro desde {date(member.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {member.supervising.length > 0 ? (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
            <Users className="size-4 text-[var(--accent-text)]" aria-hidden /> Supervisiona ({member.supervising.length})
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {member.supervising.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-2.5 pl-0.5 text-xs font-semibold text-ink">
                <Avatar name={s.user.name} email={s.user.email} size={22} />
                {displayName(s.user)}
                <span className="font-normal text-ink-3">{ROLE_LABEL[s.role]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canEdit ? (
        <section className="flex flex-col gap-5">
          <h3 className="text-sm font-bold text-ink">Editar membro</h3>
          <RolePicker value={role} onChange={setRole} roles={pickerRoles} />
          <SupervisorPicker
            options={supervisorOptions}
            value={supervisorIds}
            onChange={setSupervisorIds}
            colors={colors}
            hint="Membros que esta pessoa supervisiona não aparecem (evita ciclos)."
          />
          <div className="rounded-xl border border-line p-3">
            <Switch checked={isActive} onChange={setIsActive} label={isActive ? 'Conta ativa nesta organização' : 'Conta inativa nesta organização'} />
            <p className="mt-1.5 text-xs text-ink-3">Inativa: não consegue entrar, mas o histórico é preservado.</p>
          </div>
          {losesTeam ? (
            <p role="status" className="flex gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              Ao guardar, deixa de supervisionar {member.supervising.length} {member.supervising.length === 1 ? 'pessoa' : 'pessoas'}.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-xl border border-bad/40 bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            {member.isActive ? (
              <Button variant="ghost" className="text-bad hover:bg-bad-soft hover:text-bad" icon={UserMinus} loading={deactivate.isPending} onClick={askDeactivate}>
                Desativar
              </Button>
            ) : (
              <span />
            )}
            <Button variant="accent" icon={Save} disabled={!dirty} loading={update.isPending} onClick={save}>
              Guardar alterações
            </Button>
          </div>
        </section>
      ) : (
        <p className="flex gap-2 rounded-xl bg-surface-2 px-3 py-3 text-sm text-ink-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          {isSelf
            ? 'Este é o seu perfil. O seu papel só pode ser alterado por outro dono ou administrador; os seus dados pessoais estão em Definições.'
            : `Só pode gerir membros com papéis que lhe é permitido atribuir. Peça a um ${member.role === 'OWNER' ? 'dono' : 'dono ou administrador'} para alterar este ${ROLE_LABEL[member.role].toLowerCase()}.`}
        </p>
      )}
    </div>
  );
}
