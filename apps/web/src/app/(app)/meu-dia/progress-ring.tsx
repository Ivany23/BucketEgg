'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { AnimatedNumber } from '@/components/ui';

/** Anel de progresso colorido (concluídas / total) com número animado ao centro. */
export function ProgressRing({ done, total, size = 132 }: { done: number; total: number; size?: number }) {
  const reduce = useReducedMotion();
  const gid = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  const percent = Math.round(ratio * 100);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={`${done} de ${total} paragens concluídas (${percent}%)`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--m-dia)" />
            <stop offset="55%" stopColor="var(--m-painel)" />
            <stop offset="100%" stopColor="var(--ok)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: ratio === 0 ? 0.0001 : ratio, opacity: ratio === 0 ? 0 : 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="text-[32px] leading-none font-extrabold tracking-tight text-ink">
          <AnimatedNumber value={done} />
          <span className="text-lg font-bold text-ink-3">/{total}</span>
        </span>
        <span className="mt-1 text-xs font-bold text-[var(--accent-text)]">{percent}% feito</span>
      </div>
    </div>
  );
}
