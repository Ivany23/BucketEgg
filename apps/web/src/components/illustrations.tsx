'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Ilustrações próprias da BucketEgg (SVG inline, leves, sem pedidos de rede).
 * Usam as cores dos módulos, por isso acompanham o tema claro/escuro.
 */
export type IllustrationName =
  | 'box'
  | 'map'
  | 'truck'
  | 'clipboard'
  | 'team'
  | 'upload'
  | 'store'
  | 'success'
  | 'oops'
  | 'calendar'
  | 'cart'
  | 'search'
  | 'egg';

const C = {
  brand: 'var(--brand)',
  soft: 'var(--brand-soft)',
  blue: 'var(--m-rotas)',
  teal: 'var(--m-lojas)',
  violet: 'var(--m-beats)',
  pink: 'var(--m-vendas)',
  green: 'var(--m-visitas)',
  amber: 'var(--m-dia)',
  indigo: 'var(--m-dados)',
  sky: 'var(--m-import)',
  line: 'var(--border-strong)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',
  ink: 'var(--text-3)',
};

function Floating({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <g>{children}</g>;
  return (
    <motion.g animate={{ y: [0, -5, 0] }} transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay }}>
      {children}
    </motion.g>
  );
}

const scenes: Record<IllustrationName, ReactNode> = {
  box: (
    <>
      <ellipse cx="100" cy="128" rx="62" ry="8" fill={C.surface2} />
      <Floating>
        <path d="M52 62 100 40l48 22v46l-48 22-48-22Z" fill={C.soft} stroke={C.brand} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M52 62 100 84l48-22M100 84v46" fill="none" stroke={C.brand} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="m76 51 48 22" stroke={C.amber} strokeWidth="5" strokeLinecap="round" />
      </Floating>
      <circle cx="160" cy="44" r="6" fill={C.blue} />
      <circle cx="40" cy="40" r="4" fill={C.pink} />
      <path d="M166 92h10M171 87v10" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  map: (
    <>
      <path d="M30 40 70 28l60 16 40-12v86l-40 12-60-16-40 12Z" fill={C.surface2} stroke={C.line} strokeWidth="2" />
      <path d="M70 28v86M130 44v86" stroke={C.line} strokeWidth="2" />
      <path d="M46 98c20-6 26-34 52-30s30 30 54-4" fill="none" stroke={C.blue} strokeWidth="4" strokeLinecap="round" strokeDasharray="2 9" />
      <Floating>
        <path d="M152 30c-9 0-15 7-15 15 0 11 15 25 15 25s15-14 15-25c0-8-6-15-15-15Z" fill={C.brand} />
        <circle cx="152" cy="45" r="5.5" fill={C.surface} />
      </Floating>
      <circle cx="46" cy="98" r="7" fill={C.teal} />
      <circle cx="98" cy="68" r="5" fill={C.violet} />
    </>
  ),
  truck: (
    <>
      <ellipse cx="100" cy="128" rx="70" ry="7" fill={C.surface2} />
      <Floating>
        <rect x="34" y="58" width="84" height="50" rx="8" fill={C.brand} />
        <path d="M118 72h26l18 20v16h-44Z" fill={C.amber} />
        <path d="M126 78h16l10 12h-26Z" fill={C.surface} opacity=".8" />
        <circle cx="62" cy="112" r="11" fill={C.ink} />
        <circle cx="62" cy="112" r="4" fill={C.surface} />
        <circle cx="138" cy="112" r="11" fill={C.ink} />
        <circle cx="138" cy="112" r="4" fill={C.surface} />
        <path d="M48 76h40M48 88h26" stroke={C.surface} strokeWidth="5" strokeLinecap="round" opacity=".85" />
      </Floating>
      <path d="M18 70h10M10 84h18M16 98h12" stroke={C.blue} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  clipboard: (
    <>
      <Floating>
        <rect x="58" y="30" width="84" height="100" rx="12" fill={C.surface} stroke={C.indigo} strokeWidth="2.5" />
        <rect x="80" y="22" width="40" height="16" rx="6" fill={C.indigo} />
        <path d="m72 62 6 6 12-12" stroke={C.green} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M98 62h28" stroke={C.line} strokeWidth="5" strokeLinecap="round" />
        <path d="m72 86 6 6 12-12" stroke={C.green} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M98 86h22" stroke={C.line} strokeWidth="5" strokeLinecap="round" />
        <circle cx="80" cy="110" r="6" fill={C.amber} />
        <path d="M98 110h26" stroke={C.line} strokeWidth="5" strokeLinecap="round" />
      </Floating>
      <circle cx="160" cy="50" r="7" fill={C.pink} />
      <circle cx="38" cy="96" r="5" fill={C.brand} />
    </>
  ),
  team: (
    <>
      <ellipse cx="100" cy="130" rx="70" ry="7" fill={C.surface2} />
      <Floating>
        <circle cx="100" cy="58" r="20" fill={C.brand} />
        <path d="M66 126c0-22 15-36 34-36s34 14 34 36Z" fill={C.brand} />
      </Floating>
      <Floating delay={0.4}>
        <circle cx="54" cy="74" r="14" fill={C.violet} />
        <path d="M30 126c0-16 10-26 24-26s24 10 24 26Z" fill={C.violet} />
      </Floating>
      <Floating delay={0.8}>
        <circle cx="146" cy="74" r="14" fill={C.teal} />
        <path d="M122 126c0-16 10-26 24-26s24 10 24 26Z" fill={C.teal} />
      </Floating>
    </>
  ),
  upload: (
    <>
      <path d="M58 104h84a24 24 0 0 0 0-48 34 34 0 0 0-64-6 26 26 0 0 0-20 54Z" fill={C.surface2} stroke={C.sky} strokeWidth="2.5" />
      <Floating>
        <path d="M100 116V70m0 0-16 16m16-16 16 16" stroke={C.brand} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Floating>
      <rect x="150" y="96" width="26" height="32" rx="4" fill={C.green} />
      <path d="M156 106h14M156 113h14M156 120h8" stroke={C.surface} strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  store: (
    <>
      <ellipse cx="100" cy="130" rx="66" ry="7" fill={C.surface2} />
      <Floating>
        <rect x="46" y="62" width="108" height="64" rx="6" fill={C.surface} stroke={C.teal} strokeWidth="2.5" />
        <path d="M40 62 52 34h96l12 28Z" fill={C.teal} />
        <path d="M58 34 52 62M82 34l-4 28M106 34v28M130 34l4 28M148 34l6 28" stroke={C.surface} strokeWidth="2" opacity=".7" />
        <rect x="88" y="92" width="24" height="34" rx="3" fill={C.brand} />
        <rect x="58" y="80" width="22" height="18" rx="3" fill={C.sky} opacity=".7" />
        <rect x="120" y="80" width="22" height="18" rx="3" fill={C.sky} opacity=".7" />
      </Floating>
    </>
  ),
  success: (
    <>
      <circle cx="100" cy="78" r="46" fill={C.surface2} />
      <Floating>
        <circle cx="100" cy="78" r="32" fill={C.green} />
        <path d="m86 78 10 10 20-20" stroke={C.surface} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Floating>
      <path d="M40 40l6 6M160 36l-6 6M156 120l-6-6M44 118l6-6" stroke={C.brand} strokeWidth="3" strokeLinecap="round" />
      <circle cx="166" cy="78" r="4" fill={C.pink} />
      <circle cx="34" cy="78" r="4" fill={C.blue} />
    </>
  ),
  oops: (
    <>
      <Floating>
        <path d="M100 26 162 128H38Z" fill={C.soft} stroke={C.brand} strokeWidth="3" strokeLinejoin="round" />
        <path d="M100 62v30" stroke={C.brand} strokeWidth="7" strokeLinecap="round" />
        <circle cx="100" cy="108" r="4.5" fill={C.brand} />
      </Floating>
    </>
  ),
  calendar: (
    <>
      <Floating>
        <rect x="46" y="38" width="108" height="90" rx="12" fill={C.surface} stroke={C.amber} strokeWidth="2.5" />
        <rect x="46" y="38" width="108" height="24" rx="12" fill={C.amber} />
        <path d="M72 30v16M128 30v16" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
        {[0, 1, 2, 3].map((c) =>
          [0, 1].map((r) => (
            <rect key={`${c}-${r}`} x={62 + c * 21} y={76 + r * 22} width="14" height="14" rx="3" fill={c === 1 && r === 0 ? C.brand : C.surface2} />
          )),
        )}
      </Floating>
    </>
  ),
  cart: (
    <>
      <ellipse cx="100" cy="132" rx="60" ry="6" fill={C.surface2} />
      <Floating>
        <path d="M40 40h18l14 62h66l12-44H66" fill="none" stroke={C.pink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="80" y="62" width="20" height="26" rx="4" fill={C.brand} />
        <rect x="106" y="56" width="20" height="32" rx="4" fill={C.teal} />
        <circle cx="80" cy="120" r="8" fill={C.ink} />
        <circle cx="130" cy="120" r="8" fill={C.ink} />
      </Floating>
    </>
  ),
  search: (
    <>
      <Floating>
        <circle cx="88" cy="70" r="34" fill={C.surface2} stroke={C.blue} strokeWidth="6" />
        <path d="m112 96 28 28" stroke={C.brand} strokeWidth="10" strokeLinecap="round" />
        <path d="M74 62a16 16 0 0 1 16-12" stroke={C.surface} strokeWidth="5" strokeLinecap="round" fill="none" />
      </Floating>
    </>
  ),
  egg: (
    <>
      <ellipse cx="100" cy="134" rx="46" ry="7" fill={C.surface2} />
      <Floating>
        <path d="M100 24c-26 0-46 40-46 70 0 24 20 38 46 38s46-14 46-38c0-30-20-70-46-70Z" fill={C.brand} />
        <path d="M78 62c4-12 12-22 22-24" stroke={C.surface} strokeWidth="6" strokeLinecap="round" fill="none" opacity=".7" />
        <path d="M58 92h84l-8 26H66Z" fill={C.amber} opacity=".9" />
      </Floating>
      <circle cx="44" cy="52" r="6" fill={C.blue} />
      <circle cx="160" cy="44" r="5" fill={C.teal} />
      <circle cx="166" cy="100" r="4" fill={C.pink} />
    </>
  ),
};

export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden focusable="false">
      {scenes[name]}
    </svg>
  );
}

/** Logótipo BucketEgg: ovo laranja com balde. */
export function Logo({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="be-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdba74" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#be-logo)" />
      <path d="M20 7c-6 0-10 9-10 15 0 6 4.5 10 10 10s10-4 10-10c0-6-4-15-10-15Z" fill="#fff7ed" />
      <path d="M11.5 23h17l-2.2 7.5h-12.6Z" fill="#1f0e03" opacity=".88" />
      <path d="M15.5 14.5c1-2.6 2.6-4.4 4.5-4.8" stroke="#fdba74" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}
