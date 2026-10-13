'use client';

import { Eye, EyeOff, Info, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, useToast } from '@/components/ui';
import { RolePicker, SUPERVISOR_ROLES, assignableRoles, displayName } from '@/components/org/roles';
import { SupervisorPicker } from '@/components/org/supervisor-picker';
import { api } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Member, Role } from '@/lib/types';

type AddMemberBody = components['schemas']['AddMemberDto'];
type Errors = Partial<Record<'email' | 'password' | 'name' | 'phone' | 'form', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddMemberModal({
  open,
  onClose,
  members,
  colors,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  members: Member[];
  colors: Map<string, string>;
  onAdded: (m: Member) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      module="equipa"
      size="lg"
      title="Adicionar membro"
      description="Crie a conta de uma nova pessoa ou associe uma conta BucketEgg que já exista."
    >
      <AddMemberForm onClose={onClose} members={members} colors={colors} onAdded={onAdded} />
    </Modal>
  );
}

function AddMemberForm({
  onClose,
  members,
  colors,
  onAdded,
}: {
  onClose: () => void;
  members: Member[];
  colors: Map<string, string>;
  onAdded: (m: Member) => void;
}) {
  const { role: myRole, me, organizationId } = useSession();
  const toast = useToast();
  const roles = assignableRoles(myRole);
  const mine = members.find((m) => m.user.id === me?.id);
  const supervisorOptions = members.filter((m) => m.isActive && SUPERVISOR_ROLES.includes(m.role));

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>(roles.includes('FIELD_REP') ? 'FIELD_REP' : (roles[0] ?? 'FIELD_REP'));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Um supervisor que adiciona alguém fica, por omissão, como supervisor dessa pessoa (como na API).
  const [supervisorIds, setSupervisorIds] = useState<string[]>(myRole === 'MANAGER' && mine ? [mine.id] : []);
  const [errors, setErrors] = useState<Errors>({});

  const add = useApiMutation((body: AddMemberBody) => api<Member>('/team', { method: 'POST', body }), {
    invalidate: [['team']],
    onSuccess: (m) => {
      toast.success('Membro adicionado', `${displayName(m.user)} já pode entrar na BucketEgg.`);
      onAdded(m);
      onClose();
    },
    onError: (e) => {
      if (e.status === 409) setErrors({ email: e.message });
      else if (e.status === 400 && /palavra-passe|password/i.test(e.message)) setErrors({ password: e.message });
      else if (e.status === 400 && /email/i.test(e.message)) setErrors({ email: e.message });
      else setErrors({ form: e.message });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) next.email = 'Indique um email válido.';
    if (password && password.length < 8) next.password = 'A palavra-passe deve ter pelo menos 8 caracteres.';
    if (password.length > 72) next.password = 'Máximo de 72 caracteres.';
    if (name.length > 120) next.name = 'Máximo de 120 caracteres.';
    if (phone.length > 30) next.phone = 'Máximo de 30 caracteres.';
    setErrors(next);
    if (Object.keys(next).length) return;
    add.mutate({
      email: cleanEmail,
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      password: password || undefined,
      role,
      supervisorIds,
    });
  };

  if (!organizationId || roles.length === 0) {
    return <p className="text-sm text-ink-2">Não tem permissão para adicionar membros.</p>;
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {errors.form ? (
        <p role="alert" className="rounded-xl border border-bad/40 bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad">
          {errors.form}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" required error={errors.email} className="sm:col-span-2">
          {(a) => (
            <Input
              {...a}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="nome@empresa.co.mz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Nome" error={errors.name}>
          {(a) => <Input {...a} autoComplete="off" placeholder="Ex.: Rosa Macuácua" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Telefone" error={errors.phone}>
          {(a) => (
            <Input {...a} type="tel" inputMode="tel" autoComplete="off" placeholder="+258 84 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          )}
        </Field>
      </div>

      <RolePicker value={role} onChange={setRole} roles={roles} />
      {myRole === 'MANAGER' ? <p className="-mt-3 text-xs text-ink-3">Como supervisor, pode adicionar promotores à sua equipa.</p> : null}

      <Field
        label="Palavra-passe inicial"
        error={errors.password}
        hint={
          <span className="flex gap-1.5">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              Obrigatória se o email ainda não tiver conta na BucketEgg (mínimo 8 caracteres) — partilhe-a com a pessoa. Se a conta já existir,
              é ignorada e a pessoa entra com a palavra-passe que já usa.
            </span>
          </span>
        }
      >
        {(a) => (
          <div className="relative">
            <Input
              {...a}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        )}
      </Field>

      <SupervisorPicker
        options={supervisorOptions}
        value={supervisorIds}
        onChange={setSupervisorIds}
        colors={colors}
        hint="Os supervisores acompanham as rotas, visitas e encomendas desta pessoa. Pode escolher vários."
      />

      <div className="-mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" icon={UserPlus} loading={add.isPending}>
          Adicionar membro
        </Button>
      </div>
    </form>
  );
}
