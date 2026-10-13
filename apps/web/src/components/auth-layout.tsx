'use client';

import { CalendarCheck, ClipboardList, Route, ShoppingCart, Store, TrendingUp } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Illustration, Logo } from './illustrations';

const features = [
  { icon: Route, text: 'Rotas otimizadas com Google Maps', color: 'var(--m-rotas)' },
  { icon: CalendarCheck, text: 'O dia do promotor, paragem a paragem', color: 'var(--m-dia)' },
  { icon: Store, text: 'Lojas no mapa, com aprovação e extrato', color: 'var(--m-lojas)' },
  { icon: ShoppingCart, text: 'Encomendas com preços do catálogo', color: 'var(--m-vendas)' },
  { icon: ClipboardList, text: 'Auditorias com histórico de correções', color: 'var(--m-dados)' },
  { icon: TrendingUp, text: 'Painel com vendas e ranking da equipa', color: 'var(--m-painel)' },
];

/** Ecrã dividido: formulário à esquerda, arte da marca à direita (escondida no telemóvel). */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="glow-orange grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight text-ink">
            Bucket<span className="text-brand-text">Egg</span>
          </span>
        </Link>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10"
        >
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-ink-2">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-center text-sm text-ink-2">{footer}</div> : null}
        </motion.div>
        <p className="text-xs text-ink-3">© BucketEgg · Maputo, Moçambique</p>
      </div>
      <div className="relative hidden overflow-hidden bg-[#1f0e03] lg:block">
        <div aria-hidden className="absolute -top-24 -right-24 size-[28rem] rounded-full bg-[#f97316] opacity-40 blur-3xl" />
        <div aria-hidden className="absolute bottom-0 -left-20 size-80 rounded-full bg-[#ec4899] opacity-20 blur-3xl" />
        <div aria-hidden className="absolute top-1/3 left-1/3 size-72 rounded-full bg-[#3b82f6] opacity-15 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center px-14 text-[#fff7ed]">
          <Illustration name="truck" className="h-44 w-fit" />
          <h2 className="mt-6 max-w-md text-4xl leading-tight font-extrabold">
            Do armazém à prateleira, <span className="text-[#fb923c]">sem perder uma paragem.</span>
          </h2>
          <ul className="mt-8 grid max-w-lg gap-3">
            {features.map((f, i) => (
              <motion.li
                key={f.text}
                initial={reduce ? false : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 220, damping: 24 }}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-medium backdrop-blur"
              >
                <span className="inline-flex size-8 items-center justify-center rounded-xl" style={{ background: f.color, color: '#1a1208' }}>
                  <f.icon className="size-4" aria-hidden />
                </span>
                {f.text}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
