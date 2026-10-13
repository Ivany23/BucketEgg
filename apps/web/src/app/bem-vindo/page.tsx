'use client';

import { ArrowRight, Building2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { Button, Field, Input, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { LoginResponse, Organization } from '@/lib/types';

/** Onboarding: quem ainda não pertence a nenhuma organização cria a sua (ou aguarda convite). */
export default function WelcomePage() {
  const session = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session.loading) return;
    if (!session.token) router.replace('/entrar');
    else if (session.organizationId) router.replace('/painel');
  }, [session.loading, session.token, session.organizationId, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // A API devolve a organização e uma sessão (token) já com ela ativa.
      const res = await api<{ organization: Organization; session: LoginResponse }>('/organizations', {
        method: 'POST',
        body: { name: name.trim(), timezone: 'Africa/Maputo', currency: 'MZN' },
      });
      await session.adoptToken(res.session.access_token);
      router.replace('/painel');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (session.loading || !session.me) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <AuthLayout
      title={`Olá${session.me.name ? `, ${session.me.name.split(' ')[0]}` : ''}!`}
      subtitle="Crie a sua organização para começar. Se a sua empresa já usa a BucketEgg, peça ao supervisor para o adicionar à equipa com este email."
      footer={
        <button type="button" onClick={session.logout} className="inline-flex items-center gap-1.5 font-semibold text-ink-2 hover:text-ink">
          <LogOut className="size-4" aria-hidden /> Sair
        </button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nome da empresa" required>
          {(a) => (
            <div className="relative">
              <Building2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input {...a} value={name} onChange={(e) => setName(e.target.value)} placeholder="Distribuidora Maputo, Lda" className="h-11 pl-9" minLength={2} />
            </div>
          )}
        </Field>
        {error ? (
          <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={busy} iconRight={ArrowRight} disabled={name.trim().length < 2}>
          Criar organização
        </Button>
      </form>
    </AuthLayout>
  );
}
