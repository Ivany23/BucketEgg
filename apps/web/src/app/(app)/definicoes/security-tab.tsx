'use client';

import { Check, Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useId, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { SettingsSection } from '@/components/org/section';
import { Button, Field, Input, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { useApiMutation } from '@/lib/query';

type ChangePasswordBody = components['schemas']['ChangePasswordDto'];

const RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
  { id: 'len', label: 'Pelo menos 8 caracteres', test: (p) => p.length >= 8 },
  { id: 'long', label: '12 ou mais caracteres', test: (p) => p.length >= 12 },
  { id: 'case', label: 'Maiúsculas e minúsculas', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'digit', label: 'Pelo menos um número', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'Um símbolo (ex.: ! ? # @)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const LEVELS = [
  { label: 'Muito fraca', color: 'var(--bad)' },
  { label: 'Fraca', color: 'var(--bad)' },
  { label: 'Razoável', color: 'var(--warn)' },
  { label: 'Boa', color: 'var(--m-lojas)' },
  { label: 'Forte', color: 'var(--ok)' },
];

/** 0–4: comprimento mínimo é obrigatório; o resto soma pontos. */
export function passwordScore(p: string): number {
  if (!p) return 0;
  if (p.length < 8) return 1;
  const extra = RULES.slice(1).filter((r) => r.test(p)).length;
  return Math.min(4, 1 + extra);
}

export function SecurityTab() {
  const [round, setRound] = useState(0);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <SettingsSection icon={KeyRound} title="Alterar palavra-passe" description="Depois de alterar, use a nova palavra-passe na próxima entrada (também no telemóvel)." color="var(--m-config)">
        {/* `round` limpa o formulário depois de uma alteração bem-sucedida. */}
        <PasswordForm key={round} onDone={() => setRound((r) => r + 1)} />
      </SettingsSection>
      <aside className="shadow-soft h-fit rounded-2xl border border-line bg-surface p-5">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-ok-soft text-ok">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <h3 className="mt-3 text-sm font-bold text-ink">Dicas de segurança</h3>
        <ul className="mt-2 space-y-2 text-sm text-ink-2">
          <li>Use uma frase fácil de lembrar, como “Matola-chuva-2026!”.</li>
          <li>Não reutilize a palavra-passe do email ou do M-Pesa.</li>
          <li>Nunca partilhe a palavra-passe — nem com o supervisor.</li>
        </ul>
      </aside>
    </div>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const meterId = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});

  const change = useApiMutation((body: ChangePasswordBody) => api<{ message: string }>('/auth/change-password', { method: 'POST', body }), {
    onSuccess: (r) => {
      toast.success('Palavra-passe alterada', r?.message);
      onDone();
    },
    onError: (e) => {
      if (/atual/i.test(e.message)) setErrors({ current: e.message });
      else if (e.status === 400) setErrors({ next: e.message });
      else toast.error('Não foi possível alterar a palavra-passe', e.message);
    },
  });

  const score = passwordScore(next);
  const level = LEVELS[score];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!current) errs.current = 'Indique a palavra-passe atual.';
    if (next.length < 8) errs.next = 'A nova palavra-passe deve ter pelo menos 8 caracteres.';
    else if (next.length > 72) errs.next = 'Máximo de 72 caracteres.';
    else if (next === current) errs.next = 'A nova palavra-passe tem de ser diferente da atual.';
    if (confirm !== next) errs.confirm = 'As palavras-passe não coincidem.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    change.mutate({ currentPassword: current, newPassword: next });
  };

  const pw = (p: InputHTMLAttributes<HTMLInputElement>) => <Input {...p} type={show ? 'text' : 'password'} spellCheck={false} />;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Palavra-passe atual" required error={errors.current}>
        {(a) => pw({ ...a, autoComplete: 'current-password', value: current, onChange: (e) => setCurrent(e.target.value) })}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nova palavra-passe" required error={errors.next}>
          {(a) =>
            pw({
              ...a,
              autoComplete: 'new-password',
              value: next,
              maxLength: 72,
              onChange: (e) => setNext(e.target.value),
              'aria-describedby': [a['aria-describedby'], meterId].filter(Boolean).join(' '),
            })
          }
        </Field>
        <Field label="Confirmar nova palavra-passe" required error={errors.confirm}>
          {(a) => pw({ ...a, autoComplete: 'new-password', value: confirm, maxLength: 72, onChange: (e) => setConfirm(e.target.value) })}
        </Field>
      </div>

      <div id={meterId} className="rounded-xl bg-surface-2 p-3">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-ink-2">Força</span>
          <span aria-live="polite" style={{ color: next ? level.color : undefined }} className={cn(!next && 'text-ink-3')}>
            {next ? level.label : '—'}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <motion.span
                className="block h-full rounded-full"
                initial={false}
                animate={{ width: score >= i ? '100%' : '0%', backgroundColor: level.color }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            </span>
          ))}
        </div>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {RULES.map((r) => {
            const ok = r.test(next);
            return (
              <li key={r.id} className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-ink' : 'text-ink-3')}>
                {ok ? <Check className="size-3.5 text-ok" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                {r.label}
                <span className="sr-only">{ok ? '(cumprido)' : '(por cumprir)'}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" icon={show ? EyeOff : Eye} onClick={() => setShow((v) => !v)} aria-pressed={show}>
          {show ? 'Esconder' : 'Mostrar'} palavras-passe
        </Button>
        <Button type="submit" variant="primary" icon={KeyRound} loading={change.isPending}>
          Alterar palavra-passe
        </Button>
      </div>
    </form>
  );
}
