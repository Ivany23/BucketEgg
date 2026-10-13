'use client';

import { ArrowRight, Building2, KeyRound, Mail, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { homeFor } from '@/components/shell/nav';
import { Button, Field, Input } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function RegisterPage() {
  const session = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const weak = form.password.length > 0 && form.password.length < 8;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await session.register({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || undefined,
        organizationName: form.organizationName.trim() || undefined,
      });
      router.replace(res.needsOnboarding ? '/bem-vindo' : homeFor(res.organization?.role ?? null));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Criar a sua conta"
      subtitle="Comece em 1 minuto. Pode convidar a equipa a seguir."
      footer={
        <>
          Já tem conta?{' '}
          <Link href="/entrar" className="font-semibold text-brand-text hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="O seu nome">
          {(a) => (
            <div className="relative">
              <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input {...a} autoComplete="name" value={form.name} onChange={set('name')} placeholder="Ana Machava" className="h-11 pl-9" />
            </div>
          )}
        </Field>
        <Field label="Email" required>
          {(a) => (
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input {...a} type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="nome@empresa.co.mz" className="h-11 pl-9" />
            </div>
          )}
        </Field>
        <Field label="Palavra-passe" required hint="Pelo menos 8 caracteres." error={weak ? 'Use pelo menos 8 caracteres.' : null}>
          {(a) => (
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input {...a} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} className="h-11 pl-9" />
            </div>
          )}
        </Field>
        <Field label="Nome da empresa" hint="Cria a sua organização e fica como dono. Pode deixar em branco se vai ser convidado.">
          {(a) => (
            <div className="relative">
              <Building2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input {...a} value={form.organizationName} onChange={set('organizationName')} placeholder="Distribuidora Maputo, Lda" className="h-11 pl-9" />
            </div>
          )}
        </Field>
        {error ? (
          <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={busy} iconRight={ArrowRight} disabled={!form.email || form.password.length < 8}>
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  );
}
