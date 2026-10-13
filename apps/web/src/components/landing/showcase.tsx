'use client';

import {
  CalendarCheck,
  Check,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  History,
  MapPin,
  Route,
  ShoppingCart,
  Star,
  Store,
  TrendingUp,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useReduceMotion } from '@/lib/reduce-motion';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatedNumber } from '@/components/ui';

interface Module {
  id: string;
  icon: LucideIcon;
  name: string;
  /** chave do token de cor do módulo (--m-*) */
  m: string;
  title: string;
  text: string;
  bullets: string[];
  preview: () => ReactNode;
}

const MODULES: Module[] = [
  {
    id: 'rotas',
    icon: Route,
    name: 'Rotas',
    m: 'rotas',
    title: 'Rotas otimizadas pela Google Maps',
    text: 'Escolha as lojas e a ordem ideal é calculada automaticamente, com a hora prevista de chegada em cada paragem.',
    bullets: ['Até 25 paragens por rota', 'Hora prevista e tempo de serviço', 'Uma rota por beat por dia, sem duplicados'],
    preview: RoutesPreview,
  },
  {
    id: 'dia',
    icon: CalendarCheck,
    name: 'Meu dia',
    m: 'dia',
    title: 'O dia do promotor num só ecrã',
    text: 'Entrada, check-in com GPS em cada loja, encomenda, cobrança e saída — guiado paragem a paragem.',
    bullets: ['Check-in validado pela geocerca', 'Progresso do dia em tempo real', 'Funciona no telemóvel'],
    preview: DayPreview,
  },
  {
    id: 'lojas',
    icon: Store,
    name: 'Lojas',
    m: 'lojas',
    title: 'Lojas no mapa, com crédito sob controlo',
    text: 'Novas lojas registadas no terreno ficam a aguardar aprovação. Extrato de conta, limite de crédito e dívidas em atraso.',
    bullets: ['Aprovação pelo supervisor', 'Extrato e saldo por loja', 'Lojas próximas pelo GPS'],
    preview: StoresPreview,
  },
  {
    id: 'vendas',
    icon: ShoppingCart,
    name: 'Vendas',
    m: 'vendas',
    title: 'Encomendas e cobranças sem erros',
    text: 'Os preços vêm sempre do catálogo. Produtos Must Sell em destaque e pagamentos por M-Pesa ou numerário.',
    bullets: ['Preços do catálogo, nunca à mão', 'Must Sell por loja', 'M-Pesa, numerário e crédito'],
    preview: SalesPreview,
  },
  {
    id: 'dados',
    icon: ClipboardList,
    name: 'Auditorias',
    m: 'dados',
    title: 'Formulários e auditorias com histórico',
    text: 'Crie formulários à medida. Os supervisores corrigem os registos e cada alteração fica guardada.',
    bullets: ['Construtor de formulários', 'Fotos, números, listas, GPS', 'Histórico de cada correção'],
    preview: AuditPreview,
  },
  {
    id: 'import',
    icon: Upload,
    name: 'Importações',
    m: 'import',
    title: 'Excel gigante, sem bloquear ninguém',
    text: 'Importe ficheiros de 300 000+ linhas em segundo plano, com validação e relatório de erros por linha.',
    bullets: ['XLSX e CSV de grande volume', 'Processamento em segundo plano', 'Relatório de linhas rejeitadas'],
    preview: ImportPreview,
  },
  {
    id: 'painel',
    icon: TrendingUp,
    name: 'Painel',
    m: 'painel',
    title: 'Plano vs. real, ao vivo',
    text: 'Receita, strike rate, visitas feitas e ranking da equipa, sempre no fuso de Maputo.',
    bullets: ['Indicadores do dia e do mês', 'Ranking de promotores', 'Gráficos acessíveis'],
    preview: DashboardPreview,
  },
  {
    id: 'equipa',
    icon: Users,
    name: 'Equipa',
    m: 'equipa',
    title: 'Cada papel vê o que precisa',
    text: 'Donos, supervisores, analistas e promotores, com organigrama e equipas por supervisor.',
    bullets: ['Papéis e permissões', 'Organigrama visual', 'Vários projetos e organizações'],
    preview: TeamPreview,
  },
];

const AUTOPLAY_MS = 6500;

/** Vitrine interativa: separadores por módulo, com pré-visualização animada e rotação automática. */
export function Showcase() {
  const reduce = useReduceMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % MODULES.length), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [active, paused, reduce]);

  const select = (i: number) => {
    setActive(i);
    setPaused(true);
  };
  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const focused = tabs.current.findIndex((t) => t === document.activeElement);
    const next = ((focused >= 0 ? focused : active) + dir + MODULES.length) % MODULES.length;
    select(next);
    tabs.current[next]?.focus();
  };

  const mod = MODULES[active];
  const Preview = mod.preview;

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div role="tablist" aria-label="Módulos da BucketEgg" aria-orientation="vertical" onKeyDown={onKey} className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible">
        {MODULES.map((m, i) => {
          const selected = i === active;
          return (
            <button
              key={m.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${m.id}`}
              aria-selected={selected}
              aria-controls="showcase-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(i)}
              className={`relative flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                selected ? 'border-transparent bg-surface text-ink shadow-soft' : 'border-line text-ink-2 hover:bg-surface hover:text-ink'
              }`}
            >
              <span
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors"
                style={selected ? { background: `var(--m-${m.m})`, color: '#14100c' } : { background: `var(--m-${m.m}-soft)`, color: `var(--m-${m.m}-text)` }}
              >
                <m.icon className="size-4" aria-hidden />
              </span>
              {m.name}
              {/* Barra de tempo da rotação automática */}
              {selected && !reduce && !paused ? (
                <motion.span
                  key={`bar-${active}`}
                  aria-hidden
                  className="absolute bottom-0 left-0 h-0.5"
                  style={{ background: `var(--m-${m.m})` }}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        id="showcase-panel"
        role="tabpanel"
        aria-labelledby={`tab-${mod.id}`}
        data-module={mod.m}
        className="shadow-lift relative overflow-hidden rounded-[2rem] border border-line bg-surface"
      >
        <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full opacity-25 blur-3xl transition-colors duration-500" style={{ background: 'var(--accent)' }} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mod.id}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative grid gap-6 p-5 sm:p-8 xl:grid-cols-[1fr_1.1fr] xl:items-center"
          >
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-text)]">
                <mod.icon className="size-3.5" aria-hidden /> {mod.name}
              </span>
              <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{mod.title}</h3>
              <p className="mt-3 text-ink-2">{mod.text}</p>
              <ul className="mt-5 grid gap-2">
                {mod.bullets.map((b, i) => (
                  <motion.li
                    key={b}
                    initial={reduce ? false : { opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 + i * 0.07 }}
                    className="flex items-center gap-2 text-sm font-medium text-ink"
                  >
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-[#14100c]">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                    {b}
                  </motion.li>
                ))}
              </ul>
            </div>
            <div className="min-w-0 rounded-3xl border border-line bg-surface-2 p-4">
              <Preview />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────── Pré-visualizações (dados fictícios, só ilustrativos) ───────────── */

function Row({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReduceMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 24 }}
      className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5"
    >
      {children}
    </motion.div>
  );
}

function RoutesPreview() {
  const stops = [
    ['08:30', 'Armazém Machava', 'Partida'],
    ['09:05', 'Loja Baixa', '15 min'],
    ['09:48', 'Mercado Central', '20 min'],
    ['10:42', 'Polana Shop', '15 min'],
    ['11:30', 'Super Zimpeto', '25 min'],
  ];
  return (
    <div className="grid gap-2">
      {stops.map(([t, n, d], i) => (
        <Row key={n} delay={0.1 + i * 0.08}>
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-extrabold text-[#14100c]">{i || '★'}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{n}</span>
          <span className="text-xs text-ink-3">{d}</span>
          <span className="flex items-center gap-1 font-mono text-xs font-bold text-[var(--accent-text)]">
            <Clock className="size-3" aria-hidden />
            {t}
          </span>
        </Row>
      ))}
      <p className="mt-1 text-center text-xs font-semibold text-ink-3">42 km · 3 h 10 min · ordem calculada pela Google</p>
    </div>
  );
}

function DayPreview() {
  const reduce = useReduceMotion();
  const steps = ['Entrada às 08:12', 'Check-in · Loja Baixa', 'Encomenda · 8 450 MZN', 'Check-in · Mercado Central'];
  const pct = 62;
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
          <motion.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={reduce ? false : { strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - pct / 100) }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-ink">
            <AnimatedNumber value={pct} />%
          </span>
          <span className="text-[11px] text-ink-3">5 de 8 lojas</span>
        </div>
      </div>
      <div className="grid w-full gap-2">
        {steps.map((s, i) => (
          <Row key={s} delay={0.2 + i * 0.1}>
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-ok-soft text-ok">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            <span className="text-sm font-semibold text-ink">{s}</span>
          </Row>
        ))}
      </div>
    </div>
  );
}

function StoresPreview() {
  const reduce = useReduceMotion();
  const stores = [
    { n: 'Loja Baixa', s: 'Ativa', tone: 'ok', used: 45 },
    { n: 'Mercado Central', s: 'Em atraso', tone: 'warn', used: 92 },
    { n: 'Polana Shop', s: 'A aprovar', tone: 'info', used: 0 },
  ] as const;
  const toneClass = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', info: 'bg-info-soft text-info' } as const;
  return (
    <div className="grid gap-2">
      {stores.map((st, i) => (
        <motion.div
          key={st.n}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.1 }}
          className="rounded-2xl bg-surface px-3 py-3"
        >
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-[var(--accent-text)]" aria-hidden />
            <span className="flex-1 text-sm font-bold text-ink">{st.n}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${toneClass[st.tone]}`}>{st.s}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <motion.div
                className={`h-full rounded-full ${st.used > 80 ? 'bg-warn' : 'bg-[var(--accent)]'}`}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${st.used}%` }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
              />
            </div>
            <span className="w-24 text-right text-[11px] text-ink-3">{st.used}% do crédito</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function SalesPreview() {
  const lines = [
    ['Óleo vegetal 1 L', '12', '1 980', true],
    ['Arroz agulha 5 kg', '6', '2 340', false],
    ['Sumo de manga 1 L', '24', '3 120', true],
  ] as const;
  return (
    <div className="rounded-2xl bg-surface p-3">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <span className="text-sm font-extrabold text-ink">ORD-000124</span>
        <span className="text-xs text-ink-3">Loja Baixa</span>
      </div>
      <div className="grid gap-2 py-3">
        {lines.map(([p, q, v, must], i) => (
          <Row key={p} delay={0.1 + i * 0.08}>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{p}</span>
            {must ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-text)]">
                <Star className="size-2.5" aria-hidden /> Must Sell
              </span>
            ) : null}
            <span className="text-xs text-ink-3">×{q}</span>
            <span className="w-14 text-right font-mono text-xs font-bold text-ink">{v}</span>
          </Row>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-2">
        <span className="text-xs font-semibold text-ink-2">Total · M-Pesa</span>
        <span className="text-lg font-extrabold text-[var(--accent-text)]">
          <AnimatedNumber value={7440} /> MZN
        </span>
      </div>
    </div>
  );
}

function AuditPreview() {
  return (
    <div className="grid gap-2">
      <Row delay={0.1}>
        <span className="flex-1 text-sm text-ink-2">Facings na prateleira</span>
        <span className="font-mono text-sm font-bold text-ink">
          <span className="mr-2 text-ink-3 line-through">8</span>12
        </span>
      </Row>
      <Row delay={0.18}>
        <span className="flex-1 text-sm text-ink-2">Preço visível</span>
        <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok">Sim</span>
      </Row>
      <Row delay={0.26}>
        <span className="flex-1 text-sm text-ink-2">Material POS</span>
        <span className="text-sm font-bold text-ink">Cartaz, wobbler</span>
      </Row>
      <Row delay={0.34}>
        <History className="size-4 text-[var(--accent-text)]" aria-hidden />
        <span className="text-xs text-ink-2">
          <b className="text-ink">Ana (supervisora)</b> corrigiu «Facings» de 8 para 12 · há 5 min
        </span>
      </Row>
    </div>
  );
}

function ImportPreview() {
  const reduce = useReduceMotion();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setCount((r) => (r >= 300_000 ? 300_000 : r + 12_500)), 120);
    return () => window.clearInterval(id);
  }, [reduce]);
  const rows = reduce ? 300_000 : count;
  const pct = Math.round((rows / 300_000) * 100);
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
          <FileSpreadsheet className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">vendas_2026_completo.xlsx</p>
          <p className="text-xs text-ink-3">320 MB · 300 000 linhas</p>
        </div>
        <span className="font-mono text-sm font-extrabold text-[var(--accent-text)]">{pct}%</span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--m-rotas)] transition-[width] duration-150" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ['Lidas', rows.toLocaleString('pt-PT')],
          ['Válidas', Math.round(rows * 0.997).toLocaleString('pt-PT')],
          ['Rejeitadas', Math.round(rows * 0.003).toLocaleString('pt-PT')],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-surface-2 px-2 py-2">
            <p className="font-mono text-sm font-bold text-ink tabular-nums">{v}</p>
            <p className="text-[11px] text-ink-3">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPreview() {
  const reduce = useReduceMotion();
  const days = [
    ['Seg', 70, 62],
    ['Ter', 70, 74],
    ['Qua', 80, 68],
    ['Qui', 80, 85],
    ['Sex', 90, 88],
    ['Sáb', 60, 64],
  ] as const;
  return (
    <div>
      <div className="flex h-36 items-end gap-3 rounded-2xl bg-surface px-3 pt-3 pb-2" role="img" aria-label="Gráfico de plano contra real por dia da semana">
        {days.map(([d, plan, real], i) => (
          <div key={d} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end justify-center gap-1">
              <motion.span className="w-2.5 rounded-t bg-surface-3" initial={reduce ? false : { height: 0 }} animate={{ height: `${plan}%` }} transition={{ delay: i * 0.06, duration: 0.6 }} />
              <motion.span className="w-2.5 rounded-t bg-[var(--accent)]" initial={reduce ? false : { height: 0 }} animate={{ height: `${real}%` }} transition={{ delay: 0.15 + i * 0.06, duration: 0.6 }} />
            </div>
            <span className="text-[10px] font-semibold text-ink-3">{d}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-1.5">
        {[
          ['Maria Cossa', '128 400'],
          ['João Sitoe', '112 950'],
          ['Ana Macuácua', '98 300'],
        ].map(([n, v], i) => (
          <Row key={n} delay={0.4 + i * 0.08}>
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-extrabold text-[var(--accent-text)]">{i + 1}</span>
            <span className="flex-1 text-sm font-semibold text-ink">{n}</span>
            <span className="font-mono text-xs font-bold text-ink">{v} MZN</span>
          </Row>
        ))}
      </div>
    </div>
  );
}

function TeamPreview() {
  const reduce = useReduceMotion();
  const node = (name: string, role: string, color: string, delay: number) => (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 20 }}
      className="flex flex-col items-center rounded-2xl bg-surface px-3 py-2 text-center"
    >
      <span className="inline-flex size-9 items-center justify-center rounded-full text-xs font-extrabold text-[#14100c]" style={{ background: color }}>
        {name
          .split(' ')
          .map((p) => p[0])
          .join('')}
      </span>
      <span className="mt-1 text-xs font-bold text-ink">{name}</span>
      <span className="text-[10px] text-ink-3">{role}</span>
    </motion.div>
  );
  return (
    <div className="flex flex-col items-center gap-3">
      {node('Rui Mondlane', 'Dono', 'var(--m-painel)', 0.05)}
      <div aria-hidden className="h-4 w-px bg-line-strong" />
      <div className="grid w-full grid-cols-2 gap-3">
        {node('Ana Macuácua', 'Supervisora', 'var(--m-equipa)', 0.15)}
        {node('Paulo Nhaca', 'Analista', 'var(--m-dados)', 0.2)}
      </div>
      <div aria-hidden className="h-4 w-px bg-line-strong" />
      <div className="grid w-full grid-cols-3 gap-2">
        {node('Maria Cossa', 'Promotora', 'var(--m-dia)', 0.3)}
        {node('João Sitoe', 'Promotor', 'var(--m-lojas)', 0.36)}
        {node('Lúcia Tembe', 'Promotora', 'var(--m-vendas)', 0.42)}
      </div>
    </div>
  );
}
