'use client';

import { ArrowRight, Eye, EyeOff, KeyRound, Mail, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { homeFor } from '@/components/shell/nav';
import { Button, Field, Input } from '@/components/ui';
import { useSession } from '@/lib/session';

/** Mostra as contas de demonstração (só em ambientes com NEXT_PUBLIC_DEMO_LOGIN=1). */
const DEMO = process.env.NEXT_PUBLIC_DEMO_LOGIN === '1';

export function LoginForm() {
  const session = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Já com sessão: segue para a página inicial do papel.
  useEffect(() => {
    if (!session.loading && session.token && session.me) router.replace(session.organizationId ? homeFor(session.role) : '/bem-vindo');
  }, [session.loading, session.token, session.me, session.organizationId, session.role, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await session.login(email.trim(), password);
      router.replace(res.needsOnboarding ? '/bem-vindo' : homeFor(res.organization?.role ?? null));
    } catch (err) {
      setError((err as Error).message || 'Não foi possível entrar.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {params.get('expirou') ? (
        <p role="status" className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          A sua sessão terminou. Entre de novo para continuar.
        </p>
      ) : null}
      <Field label="Email" required>
        {(a) => (
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input {...a} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.co.mz" className="h-11 pl-9" />
          </div>
        )}
      </Field>
      <Field label="Palavra-passe" required>
        {(a) => (
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input
              {...a}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-11 pl-9"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
              className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 hover:text-ink"
            >
              {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        )}
      </Field>
      {error ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" loading={busy} iconRight={ArrowRight} disabled={!email || !password}>
        Entrar
      </Button>
      <p className="text-center text-sm text-ink-2">
        Ainda não tem conta?{' '}
        <Link href="/criar-conta" className="font-semibold text-brand-text hover:underline">
          Criar conta grátis
        </Link>
      </p>
      {DEMO ? (
      <div className="mt-2 rounded-2xl border border-dashed border-line-strong bg-surface/70 p-4 text-[13px] text-ink-2">
        <p className="flex items-center gap-1.5 font-semibold text-ink">
          <Sparkles className="size-4 text-brand" aria-hidden /> Conta de demonstração
        </p>
        <p className="mt-1">
          <button
            type="button"
            className="font-mono text-brand-text hover:underline"
            onClick={() => {
              setEmail('dono@bucketegg.demo');
              setPassword('Demo2026Forte');
            }}
          >
            dono@bucketegg.demo
          </button>{' '}
          · palavra-passe <span className="font-mono">Demo2026Forte</span>. Promotor:{' '}
          <button
            type="button"
            className="font-mono text-brand-text hover:underline"
            onClick={() => {
              setEmail('joao.mabunda@bucketegg.demo');
              setPassword('Demo2026Forte');
            }}
          >
            joao.mabunda@…
          </button>
        </p>
      </div>
      ) : null}
    </form>
  );
}
