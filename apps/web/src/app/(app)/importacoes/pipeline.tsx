'use client';

import { CheckCircle2, Clock, Cog, CloudUpload, XCircle, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/components/ui';

export type PipelineStep = 0 | 1 | 2 | 3;
export interface PipelineState {
  /** Passo atual (null = nada a decorrer: mostra o guia). */
  step: PipelineStep | null;
  failed?: boolean;
}

const STEPS: { label: string; hint: string; icon: LucideIcon; color: string; text: string }[] = [
  { label: 'Enviar', hint: 'O ficheiro sobe para o servidor', icon: CloudUpload, color: 'var(--m-import)', text: 'var(--m-import-text)' },
  { label: 'Em fila', hint: 'Aguarda a vez de ser processado', icon: Clock, color: 'var(--m-dia)', text: 'var(--m-dia-text)' },
  { label: 'A importar', hint: 'Linhas lidas e validadas em lotes', icon: Cog, color: 'var(--m-beats)', text: 'var(--m-beats-text)' },
  { label: 'Concluída', hint: 'Dados prontos a consultar', icon: CheckCircle2, color: 'var(--m-visitas)', text: 'var(--m-visitas-text)' },
];

/** Ilustração do percurso de uma importação: cada passo tem a sua cor. */
export function ImportPipeline({ state }: { state: PipelineState }) {
  const reduce = useReducedMotion();
  const { step, failed } = state;
  const status = step === null ? 'Envie um ficheiro para começar.' : failed ? `A importação parou no passo "${STEPS[step].label}".` : `Passo atual: ${STEPS[step].label}.`;
  return (
    <div className="shadow-soft relative overflow-hidden rounded-3xl border border-line bg-surface p-4 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(18rem 10rem at 0% 0%, color-mix(in oklab, var(--m-import) 14%, transparent), transparent 70%), radial-gradient(18rem 10rem at 100% 100%, color-mix(in oklab, var(--m-visitas) 12%, transparent), transparent 70%)',
        }}
      />
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <ol className="relative grid grid-cols-4 gap-1 sm:gap-2">
        {STEPS.map((s, i) => {
          const Icon = failed && i === step ? XCircle : s.icon;
          const done = step !== null && (i < step || (i === step && step === 3 && !failed));
          const current = step !== null && i === step && !done;
          const color = failed && i === step ? 'var(--bad)' : s.color;
          const text = failed && i === step ? 'var(--bad)' : s.text;
          const lit = step === null || done || current;
          return (
            <li key={s.label} className="relative flex flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
              {i < STEPS.length - 1 ? (
                <span aria-hidden className="absolute top-6 left-[calc(50%+28px)] h-1 w-[calc(100%-56px)] overflow-hidden rounded-full bg-surface-3 sm:top-7 sm:left-[calc(50%+34px)] sm:w-[calc(100%-68px)]">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${s.color}, ${STEPS[i + 1].color})` }}
                    initial={false}
                    animate={{ width: step === null || (step !== null && i < step) ? '100%' : current && !reduce ? ['0%', '100%'] : '0%' }}
                    transition={current && !reduce ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 200, damping: 30 }}
                  />
                </span>
              ) : null}
              <motion.span
                initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 18 }}
                className={cn('relative inline-flex size-12 items-center justify-center rounded-2xl sm:size-14', !lit && 'grayscale-[0.6] opacity-55')}
                style={{ background: `color-mix(in oklab, ${color} 18%, var(--surface))`, color: text }}
              >
                {current && !failed && !reduce ? (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-2xl"
                    style={{ boxShadow: `0 0 0 3px ${color}` }}
                    animate={{ opacity: [0.9, 0.15, 0.9], scale: [1, 1.12, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : null}
                <motion.span
                  animate={current && i === 2 && !failed && !reduce ? { rotate: 360 } : { rotate: 0 }}
                  transition={current && i === 2 ? { duration: 2.4, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
                  className="inline-flex"
                >
                  <Icon className="size-6 sm:size-7" aria-hidden />
                </motion.span>
                {done ? (
                  <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full border-2 border-surface" style={{ background: 'var(--ok)' }}>
                    <CheckCircle2 className="size-3 text-white" aria-hidden />
                  </span>
                ) : null}
              </motion.span>
              <span className="mt-2 text-[12px] font-bold sm:text-sm" style={{ color: lit ? text : undefined }}>
                {s.label}
              </span>
              <span className="mt-0.5 hidden max-w-[11rem] text-xs text-ink-3 sm:block">{s.hint}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
