'use client';

import { Banknote, MapPin, ShoppingCart, Store, Truck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useReduceMotion } from '@/lib/reduce-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatedNumber } from '@/components/ui';

/** Percurso da rota no mapa ilustrado (coordenadas do viewBox 320×220). */
const ROUTE = 'M38 182 C 70 150, 70 120, 104 112 S 150 70, 186 82 S 238 140, 262 108 S 270 50, 292 36';
const STOPS = [
  { x: 38, y: 182, label: 'Armazém' },
  { x: 104, y: 112, label: 'Loja Baixa' },
  { x: 186, y: 82, label: 'Mercado Central' },
  { x: 262, y: 108, label: 'Polana Shop' },
  { x: 292, y: 36, label: 'Zimpeto' },
];

const EVENTS = [
  { icon: MapPin, color: 'var(--m-visitas)', title: 'Check-in com GPS', text: 'Loja Baixa · a 23 m do ponto' },
  { icon: ShoppingCart, color: 'var(--m-vendas)', title: 'Nova encomenda', text: 'ORD-000124 · 12 450 MZN' },
  { icon: Banknote, color: 'var(--m-dia)', title: 'Cobrança M-Pesa', text: 'Mercado Central · 3 000 MZN' },
  { icon: Store, color: 'var(--m-lojas)', title: 'Loja nova', text: 'Polana Shop · a aguardar aprovação' },
];

/** Cena animada do destaque: mapa com a rota a desenhar-se, carrinha em movimento e eventos ao vivo. */
export function HeroScene() {
  const reduce = useReduceMotion();
  const [event, setEvent] = useState(0);
  const [sales, setSales] = useState(48_250);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setEvent((e) => (e + 1) % EVENTS.length);
      setSales((s) => (s > 90_000 ? 48_250 : s + 4_150));
    }, 2800);
    return () => window.clearInterval(id);
  }, [reduce]);

  const ev = EVENTS[event];

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div aria-hidden className="absolute inset-4 rounded-[2.5rem] bg-gradient-to-br from-[#f97316]/30 via-[#ec4899]/20 to-[#3b82f6]/25 blur-3xl" />

      <div className="shadow-lift relative overflow-hidden rounded-[2rem] border border-line bg-surface">
        {/* Barra do "ecrã" */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--m-visitas)] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[var(--m-visitas)]" />
            </span>
            <span className="text-xs font-bold text-ink">Ao vivo · Maputo</span>
          </div>
          <span className="rounded-full bg-[var(--m-rotas-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--m-rotas-text)]">Rota otimizada · −18% km</span>
        </div>

        {/* Mapa ilustrado */}
        <div className="relative bg-surface-2">
          <svg viewBox="0 0 320 220" className="block w-full" role="img" aria-label="Mapa de uma rota com cinco paragens em Maputo">
            <defs>
              <linearGradient id="hero-route" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#f97316" />
                <stop offset=".55" stopColor="#ec4899" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            {/* Quarteirões e ruas */}
            <g fill="var(--surface-3)">
              <rect x="12" y="14" width="70" height="52" rx="8" />
              <rect x="96" y="14" width="64" height="40" rx="8" />
              <rect x="214" y="150" width="92" height="56" rx="8" />
              <rect x="120" y="140" width="76" height="66" rx="8" />
              <rect x="12" y="84" width="56" height="50" rx="8" />
              <rect x="206" y="12" width="60" height="44" rx="8" />
            </g>
            <path d="M0 76 H320 M0 136 H320 M90 0 V220 M200 0 V220" stroke="var(--border)" strokeWidth="6" fill="none" />
            {/* Baía */}
            <path d="M250 220 C 270 190, 300 180, 320 176 V220 Z" fill="color-mix(in oklab, var(--m-rotas) 22%, transparent)" />
            {/* Rota */}
            <motion.path
              d={ROUTE}
              fill="none"
              stroke="url(#hero-route)"
              strokeWidth="5"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.2, ease: 'easeInOut', delay: 0.3 }}
            />
            {STOPS.map((s, i) => (
              <motion.g
                key={s.label}
                initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.4, type: 'spring', stiffness: 300, damping: 18 }}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              >
                {i === event + 1 ? <circle cx={s.x} cy={s.y} r="9" fill="#f97316" className="be-ping" /> : null}
                <circle cx={s.x} cy={s.y} r="9" fill={i === 0 ? '#1f0e03' : '#fff'} stroke={i === 0 ? '#f97316' : 'url(#hero-route)'} strokeWidth="3" />
                <text x={s.x} y={s.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill={i === 0 ? '#fdba74' : '#1f0e03'}>
                  {i === 0 ? '★' : i}
                </text>
              </motion.g>
            ))}
            {/* Carrinha a percorrer a rota (SVG nativo, leve) */}
            {!reduce ? (
              <g>
                <circle r="7" fill="#1f0e03" />
                <circle r="3.5" fill="#fb923c" />
                <animateMotion dur="9s" repeatCount="indefinite" path={ROUTE} begin="2.4s" />
              </g>
            ) : null}
          </svg>

          {/* Evento ao vivo por cima do mapa */}
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 sm:left-auto sm:w-64" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={event}
                initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="shadow-lift flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-3 py-2.5 backdrop-blur"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${ev.color} 18%, transparent)`, color: ev.color }}>
                  <ev.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-ink">{ev.title}</span>
                  <span className="block truncate text-[11px] text-ink-2">{ev.text}</span>
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-3 gap-2 p-4 text-center">
          <Kpi color="var(--m-rotas)" label="paragens hoje" value={<AnimatedNumber value={36} />} />
          <Kpi color="var(--m-visitas)" label="plano feito" value={<><AnimatedNumber value={Math.min(98, 48 + event * 9)} />%</>} />
          <Kpi color="var(--m-vendas)" label="MZN vendidos" value={<AnimatedNumber value={sales} />} />
        </div>
      </div>

      {/* Cartões a flutuar à volta */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1, type: 'spring', stiffness: 200, damping: 20 }}
        className="absolute top-16 -left-6 hidden sm:block"
      >
        <div className="be-float shadow-lift flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-[var(--m-dia-soft)] text-[var(--m-dia-text)]">
            <Truck className="size-4" aria-hidden />
          </span>
          <span>
            <span className="block text-[11px] text-ink-3">Próxima paragem</span>
            <span className="block text-xs font-bold text-ink">10:42 · Mercado Central</span>
          </span>
        </div>
      </motion.div>
      <motion.div
        initial={reduce ? false : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.4, type: 'spring', stiffness: 200, damping: 20 }}
        className="absolute -top-9 left-[40%] hidden sm:block"
      >
        <div className="be-float-slow shadow-lift rounded-2xl border border-line bg-surface px-3 py-2">
          <span className="block text-[11px] text-ink-3">Strike rate</span>
          <span className="flex items-end gap-1">
            <span className="text-lg leading-none font-extrabold text-[var(--m-visitas-text)]">82%</span>
            <span className="flex h-5 items-end gap-0.5" aria-hidden>
              {[40, 60, 45, 75, 90].map((h, i) => (
                <motion.span
                  key={i}
                  className="w-1.5 rounded-sm bg-[var(--m-visitas)]"
                  initial={reduce ? false : { height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 1.6 + i * 0.08, type: 'spring', stiffness: 200, damping: 18 }}
                />
              ))}
            </span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function Kpi({ value, label, color }: { value: ReactNode; label: string; color: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-3">
      <p className="text-lg font-extrabold text-ink sm:text-xl">{value}</p>
      <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-ink-3">
        <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </p>
    </div>
  );
}
