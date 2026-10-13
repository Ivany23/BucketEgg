'use client';

import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  Crown,
  Database,
  Globe,
  Layers,
  MapPin,
  Moon,
  Route,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Timer,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { motion, useInView } from 'motion/react';
import { useReduceMotion } from '@/lib/reduce-motion';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Illustration, Logo } from '@/components/illustrations';
import Link from 'next/link';
import { AnimatedNumber } from '@/components/ui';

const ease = [0.22, 1, 0.36, 1] as const;

/** Aparece suavemente ao entrar no ecrã. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReduceMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({ eyebrow, title, text, color = 'var(--brand-text)' }: { eyebrow: string; title: ReactNode; text?: string; color?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-extrabold tracking-[0.18em] uppercase" style={{ color }}>
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {text ? <p className="mt-4 text-lg text-ink-2">{text}</p> : null}
    </Reveal>
  );
}

/* ───────────── Faixa infinita de módulos ───────────── */

const STRIP: [LucideIcon, string, string][] = [
  [Route, 'Rotas otimizadas', 'rotas'],
  [CalendarCheck, 'Meu dia', 'dia'],
  [Store, 'Lojas e crédito', 'lojas'],
  [ShoppingCart, 'Encomendas', 'vendas'],
  [ClipboardList, 'Auditorias', 'dados'],
  [Upload, 'Importação de Excel', 'import'],
  [TrendingUp, 'Painel ao vivo', 'painel'],
  [Users, 'Equipa e papéis', 'equipa'],
  [Layers, 'Beats semanais', 'beats'],
  [MapPin, 'Check-in com GPS', 'visitas'],
];

export function ModuleMarquee() {
  const items = [...STRIP, ...STRIP];
  return (
    <div className="relative overflow-hidden py-6 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]" aria-hidden>
      <div className="be-marquee flex w-max gap-3">
        {items.map(([Icon, label, m], i) => (
          <span key={i} className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold whitespace-nowrap text-ink shadow-soft">
            <span className="inline-flex size-7 items-center justify-center rounded-full" style={{ background: `var(--m-${m}-soft)`, color: `var(--m-${m}-text)` }}>
              <Icon className="size-3.5" />
            </span>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Números (contam ao entrar no ecrã) ───────────── */

function CountWhenVisible({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: '-40px' });
  return (
    <span ref={ref}>
      <AnimatedNumber value={seen ? value : 0} />
      {suffix}
    </span>
  );
}

const STATS = [
  { value: 300000, suffix: '+', label: 'linhas por ficheiro Excel', color: 'var(--m-import)', icon: Upload },
  { value: 500, suffix: '+', label: 'utilizadores em simultâneo', color: 'var(--m-equipa)', icon: Users },
  { value: 25, suffix: '', label: 'paragens otimizadas por rota', color: 'var(--m-rotas)', icon: Route },
  { value: 365, suffix: '', label: 'backups incrementais por ano', color: 'var(--m-visitas)', icon: ShieldCheck },
];

export function StatsBand() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-[#1f0e03] px-6 py-10 text-[#fff7ed] sm:px-10">
      <div aria-hidden className="be-spin-slow absolute -top-40 -right-40 size-[30rem] rounded-full bg-[conic-gradient(from_0deg,#f97316,#ec4899,#8b5cf6,#3b82f6,#f97316)] opacity-25 blur-3xl" />
      <div className="relative grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08}>
            <span className="inline-flex size-10 items-center justify-center rounded-xl" style={{ background: s.color, color: '#14100c' }}>
              <s.icon className="size-5" aria-hidden />
            </span>
            <p className="mt-4 text-2xl font-extrabold tracking-tight sm:text-4xl">
              <CountWhenVisible value={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-1 text-sm text-[#fed7aa]">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Como funciona ───────────── */

const STEPS = [
  { icon: Upload, title: 'Importe as lojas e o catálogo', text: 'Envie o Excel com lojas, produtos e preços. A BucketEgg valida tudo linha a linha.', m: 'import', art: 'upload' as const },
  { icon: Layers, title: 'Planeie beats e rotas', text: 'Agrupe as lojas por dia da semana e gere as rotas otimizadas para cada promotor.', m: 'beats', art: 'calendar' as const },
  { icon: Smartphone, title: 'A equipa executa no terreno', text: 'Check-in com GPS, encomendas, cobranças e auditorias — tudo pelo telemóvel.', m: 'dia', art: 'truck' as const },
  { icon: BarChart3, title: 'Acompanhe e decida', text: 'O painel mostra plano vs. real, vendas e ranking, e o supervisor corrige o que for preciso.', m: 'painel', art: 'success' as const },
];

export function HowItWorks() {
  const reduce = useReduceMotion();
  return (
    <div className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Linha que liga os passos (ecrãs largos) */}
      <motion.div
        aria-hidden
        className="absolute top-[4.25rem] right-[12%] left-[12%] hidden h-0.5 origin-left bg-gradient-to-r from-[var(--m-import)] via-[var(--m-dia)] to-[var(--m-painel)] lg:block"
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 1.2, ease }}
      />
      {STEPS.map((s, i) => (
        <Reveal key={s.title} delay={i * 0.12} className="relative">
          <div className="shadow-soft h-full rounded-3xl border border-line bg-surface p-5 transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <span className="relative z-10 inline-flex size-12 items-center justify-center rounded-2xl text-lg font-extrabold text-[#14100c]" style={{ background: `var(--m-${s.m})` }}>
                {i + 1}
              </span>
              <s.icon className="size-5" style={{ color: `var(--m-${s.m}-text)` }} aria-hidden />
            </div>
            <Illustration name={s.art} className="mx-auto mt-4 h-24 w-auto" />
            <h3 className="mt-4 font-extrabold text-ink">{s.title}</h3>
            <p className="mt-1.5 text-sm text-ink-2">{s.text}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ───────────── Para quem ───────────── */

const ROLES = [
  { icon: Crown, role: 'Donos', m: 'painel', text: 'Visão completa da operação, vários projetos e organizações, receita e cobranças.', items: ['Painel global', 'Projetos e organizações', 'Definições da empresa'] },
  { icon: UserCheck, role: 'Supervisores', m: 'equipa', text: 'Planeiam rotas, aprovam lojas novas e corrigem auditorias da sua equipa.', items: ['Beats e rotas', 'Aprovação de lojas', 'Correção com histórico'] },
  { icon: Briefcase, role: 'Analistas', m: 'dados', text: 'Importam dados em massa, desenham formulários e exportam relatórios.', items: ['Importações gigantes', 'Construtor de formulários', 'Exportação de dados'] },
  { icon: Smartphone, role: 'Promotores', m: 'dia', text: 'Seguem o dia paragem a paragem, vendem e cobram sem papel.', items: ['Meu dia guiado', 'Encomendas e cobranças', 'Registo de lojas novas'] },
];

export function Roles() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ROLES.map((r, i) => (
        <Reveal key={r.role} delay={i * 0.08}>
          <div className="group shadow-soft relative h-full overflow-hidden rounded-3xl border border-line bg-surface p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift">
            <div aria-hidden className="absolute -top-16 -right-16 size-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40" style={{ background: `var(--m-${r.m})` }} />
            <span className="relative inline-flex size-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ background: `var(--m-${r.m}-soft)`, color: `var(--m-${r.m}-text)` }}>
              <r.icon className="size-6" aria-hidden />
            </span>
            <h3 className="relative mt-4 text-lg font-extrabold text-ink">{r.role}</h3>
            <p className="relative mt-1.5 text-sm text-ink-2">{r.text}</p>
            <ul className="relative mt-4 grid gap-1.5">
              {r.items.map((it) => (
                <li key={it} className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: `var(--m-${r.m})` }} />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ───────────── Garantias técnicas (bento) ───────────── */

export function Trust() {
  const cards = [
    { icon: Zap, title: 'Rápida em qualquer rede', text: 'Ecrãs leves, carregamento instantâneo entre páginas e dados em cache.', m: 'dia', wide: true },
    { icon: ShieldCheck, title: 'Backup todos os dias', text: 'Cópia incremental às 00h00 — acrescenta, nunca sobrepõe.', m: 'visitas', wide: false },
    { icon: Globe, title: 'Feita para Moçambique', text: 'Meticais, português e fuso Africa/Maputo em todos os relatórios.', m: 'painel', wide: false },
    { icon: Database, title: 'Base de dados na Europa', text: 'Servidor principal em Frankfurt, com cópia de segurança noutra região.', m: 'rotas', wide: false },
    { icon: Moon, title: 'Modo claro e escuro', text: 'Segue o sistema ou a sua preferência, com contraste acessível (WCAG AA).', m: 'beats', wide: false },
    { icon: Timer, title: 'Sempre ao segundo', text: 'Cada visita, encomenda e correção fica registada com hora e autor.', m: 'vendas', wide: true },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((c, i) => (
        <Reveal key={c.title} delay={(i % 3) * 0.08} className={c.wide ? 'md:col-span-2' : ''}>
          <div className="shadow-soft flex h-full items-start gap-4 rounded-3xl border border-line bg-surface p-5">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `var(--m-${c.m}-soft)`, color: `var(--m-${c.m}-text)` }}>
              <c.icon className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-extrabold text-ink">{c.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{c.text}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ───────────── Perguntas frequentes ───────────── */

const FAQ = [
  ['A BucketEgg funciona no telemóvel?', 'Sim. Todos os ecrãs adaptam-se ao telemóvel; o promotor faz o dia inteiro — entrada, check-in, encomendas e cobranças — a partir do browser.'],
  ['Como são calculadas as rotas?', 'Com a Google Maps (Routes API): escolhe as lojas e a ordem é otimizada para menos quilómetros, com a hora prevista em cada paragem. Até 25 paragens por rota.'],
  ['Posso importar os meus ficheiros Excel?', 'Sim, incluindo ficheiros muito grandes (300 000+ linhas). A importação corre em segundo plano e no fim recebe o relatório das linhas aceites e rejeitadas.'],
  ['Os meus dados ficam seguros?', 'A base de dados principal está em Frankfurt e é copiada todos os dias às 00h00 para outra região, de forma incremental — nada é sobreposto.'],
  ['Quem vê o quê?', 'Cada papel tem as suas permissões: donos veem tudo, supervisores a sua equipa, analistas os dados e promotores o seu dia.'],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      {FAQ.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <Reveal key={q} delay={i * 0.05}>
            <div className={`rounded-2xl border bg-surface transition-colors ${isOpen ? 'border-[var(--brand)]' : 'border-line'}`}>
              <h3>
                <button
                  type="button"
                  id={`${base}-q${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`${base}-a${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold text-ink"
                >
                  {q}
                  <ChevronDown className={`size-5 shrink-0 text-ink-3 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-text' : ''}`} aria-hidden />
                </button>
              </h3>
              <div
                id={`${base}-a${i}`}
                role="region"
                aria-labelledby={`${base}-q${i}`}
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-4 text-sm text-ink-2">{a}</p>
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

/* ───────────── Chamada final e rodapé ───────────── */

export function FinalCta() {
  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#f97316] via-[#f45d48] to-[#ec4899] px-6 py-14 text-center text-[#1f0e03] sm:px-12">
        <div aria-hidden className="be-dots absolute inset-0 opacity-40" />
        <Illustration name="egg" className="be-float absolute -bottom-6 -left-6 hidden h-40 w-auto opacity-90 md:block" />
        <Illustration name="cart" className="be-float-slow absolute -top-4 -right-6 hidden h-36 w-auto opacity-90 md:block" />
        <div className="relative mx-auto max-w-2xl">
          <Sparkles className="mx-auto size-8" aria-hidden />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">Comece hoje. A primeira rota sai em minutos.</h2>
          <p className="mt-4 text-lg font-medium text-[#3b1a06]">Crie a conta, convide a equipa e importe as suas lojas — sem instalar nada.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/criar-conta"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#1f0e03] px-5 text-[15px] font-semibold text-[#fff7ed] transition-[background,transform] duration-150 hover:bg-[#3b1a06] active:scale-[0.97]"
            >
              Criar conta grátis <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/entrar"
              className="inline-flex h-12 items-center rounded-xl bg-white/30 px-5 text-[15px] font-semibold text-[#1f0e03] transition-[background,transform] duration-150 hover:bg-white/50 active:scale-[0.97]"
            >
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export function Footer() {
  const cols: [string, [string, string][]][] = [
    ['Produto', [['Funcionalidades', '#funcionalidades'], ['Como funciona', '#como-funciona'], ['Para quem', '#para-quem']]],
    ['Conta', [['Entrar', '/entrar'], ['Criar conta', '/criar-conta'], ['Perguntas', '#perguntas']]],
  ];
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-extrabold tracking-tight text-ink">
              Bucket<span className="text-brand-text">Egg</span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-ink-2">Route-to-market para equipas no terreno: rotas, visitas, vendas e dados numa só plataforma.</p>
        </div>
        {cols.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="text-sm font-extrabold text-ink">{title}</p>
            <ul className="mt-3 grid gap-2">
              {links.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-sm text-ink-2 transition-colors hover:text-brand-text">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="border-t border-line py-5 text-center text-xs text-ink-3">© BucketEgg · Maputo, Moçambique</p>
    </footer>
  );
}
