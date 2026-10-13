'use client';

import { Building2, CalendarDays, Lock, Save, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { RoleBadge } from '@/components/domain';
import { SettingsSection } from '@/components/org/section';
import { Avatar, Button, Field, Input, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { date } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Me } from '@/lib/types';

type UpdateProfileBody = components['schemas']['UpdateProfileDto'];

export function ProfileTab() {
  const { me } = useSession();
  if (!me) return <Skeleton className="h-80" />;
  // Remonta quando o perfil muda (ex.: depois de guardar), para o formulário refletir os dados atuais.
  return <ProfileForm key={`${me.id}:${me.name}:${me.phone}`} me={me} />;
}

function ProfileForm({ me }: { me: Me }) {
  const { role, organizationName } = useSession();
  const toast = useToast();
  const [name, setName] = useState(me.name ?? '');
  const [phone, setPhone] = useState(me.phone ?? '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const save = useApiMutation((body: UpdateProfileBody) => api<Pick<Me, 'id' | 'email' | 'name' | 'phone'>>('/users/me', { method: 'PATCH', body }), {
    invalidate: [['me']],
    onSuccess: () => toast.success('Perfil atualizado'),
    onError: (e) => toast.error('Não foi possível guardar o perfil', e.message),
  });

  const dirty = name.trim() !== (me.name ?? '') || phone.trim() !== (me.phone ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Indique o seu nome.';
    else if (name.trim().length > 120) next.name = 'Máximo de 120 caracteres.';
    if (phone.trim().length > 30) next.phone = 'Máximo de 30 caracteres.';
    else if (phone.trim() && !/^[+\d][\d\s()-]{5,}$/.test(phone.trim())) next.phone = 'Use só números, espaços e o indicativo (ex.: +258 84 000 0000).';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({ name: name.trim(), phone: phone.trim() });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <SettingsSection icon={UserRound} title="Dados pessoais" description="Como aparece para a equipa nas rotas, visitas e encomendas.">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={errors.name}>
              {(a) => <Input {...a} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />}
            </Field>
            <Field label="Telefone" error={errors.phone} hint="Usado pela equipa para o contactar no terreno.">
              {(a) => (
                <Input {...a} type="tel" inputMode="tel" autoComplete="tel" placeholder="+258 84 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
              )}
            </Field>
          </div>
          <Field
            label="Email"
            hint={
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3" aria-hidden /> O email identifica a sua conta e não pode ser alterado aqui.
              </span>
            }
          >
            {(a) => <Input {...a} type="email" value={me.email} readOnly aria-readonly="true" className="cursor-default bg-surface-2 text-ink-2" />}
          </Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button
              variant="ghost"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setName(me.name ?? '');
                setPhone(me.phone ?? '');
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

      <aside aria-label="Pré-visualização do perfil" className="shadow-soft h-fit overflow-hidden rounded-2xl border border-line bg-surface">
        <div
          aria-hidden
          className="h-24"
          style={{
            background:
              'radial-gradient(12rem 6rem at 10% 0%, color-mix(in oklab, var(--m-painel) 55%, transparent), transparent 70%), radial-gradient(12rem 6rem at 100% 100%, color-mix(in oklab, var(--m-equipa) 45%, transparent), transparent 70%), var(--surface-2)',
          }}
        />
        <div className="-mt-10 flex flex-col items-center px-5 pb-5 text-center">
          <span className="rounded-full border-4 border-[var(--surface)]">
            <Avatar name={name.trim() || null} email={me.email} size={80} />
          </span>
          <p className="mt-2 max-w-full truncate text-lg font-extrabold text-ink">{name.trim() || 'Sem nome'}</p>
          <p className="max-w-full truncate text-sm text-ink-3">{phone.trim() || me.email}</p>
          {role ? (
            <div className="mt-2">
              <RoleBadge role={role} />
            </div>
          ) : null}
          <ul className="mt-4 w-full space-y-1.5 border-t border-line pt-4 text-left text-xs text-ink-2">
            <li className="flex items-center gap-2">
              <Building2 className="size-3.5 text-ink-3" aria-hidden />
              <span className="truncate">{organizationName}</span>
            </li>
            <li className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-ink-3" aria-hidden />
              Conta criada a {date(me.createdAt)}
            </li>
          </ul>
          <p className="mt-3 text-[11px] text-ink-3">As iniciais e a cor do avatar vêm do seu nome.</p>
        </div>
      </aside>
    </div>
  );
}
