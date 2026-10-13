'use client';

import { ArrowRight, CheckCircle2, MapPin, Menu, Moon, Sun, X } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion, useScroll, useSpring } from 'motion/react';
import { useReduceMotion } from '@/lib/reduce-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/illustrations';
import { HeroScene } from '@/components/landing/hero-scene';
import { Faq, FinalCta, Footer, HowItWorks, ModuleMarquee, Reveal, Roles, SectionTitle, StatsBand, Trust } from '@/components/landing/sections';
import { Showcase } from '@/components/landing/showcase';
import { homeFor } from '@/components/shell/nav';
import { ButtonLink } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const NAV = [
  ['Funcionalidades', '#funcionalidades'],
  ['Como funciona', '#como-funciona'],
  ['Para quem', '#para-quem'],
  ['Perguntas', '#perguntas'],
] as const;

/** Palavras que vão rodando no título. */
const WORDS = ['a vender mais.', 'sem papel.', 'em tempo real.', 'sempre na rota.'];

export default function Home() {
  const session = useSession();
  const router = useRouter();
  const reduce = useReduceMotion();
  const [word, setWord] = useState(0);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    if (!session.loading && session.token && session.me) router.replace(session.organizationId ? homeFor(session.role) : '/bem-vindo');
  }, [session.loading, session.token, session.me, session.organizationId, session.role, router]);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2600);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    // reducedMotion="user": com "reduzir movimento" no sistema, as deslocações são desligadas
    <MotionConfig reducedMotion="user">
    <div className="glow-orange min-h-dvh overflow-x-clip">
      {/* Barra de progresso da leitura */}
      <motion.div aria-hidden className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-[#f97316] via-[#ec4899] to-[#3b82f6]" style={{ scaleX: progress }} />

      <Header />

      <main>
        {/* ───────── Destaque ───────── */}
        <section className="relative mx-auto max-w-6xl px-6 pt-10 pb-10 lg:pt-16">
          <div aria-hidden className="be-dots pointer-events-none absolute inset-0 -z-0 opacity-60" />
          <div className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-bold text-brand-text backdrop-blur">
                <MapPin className="size-3.5" aria-hidden /> Feito para Moçambique · MZN · Africa/Maputo
              </span>
              <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight text-ink sm:text-6xl">
                A sua equipa no terreno, organizada e{' '}
                <span className="relative inline-block min-w-[9ch] align-bottom">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={word}
                      initial={reduce ? false : { opacity: 0, y: '0.4em', filter: 'blur(6px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: '-0.4em', filter: 'blur(6px)' }}
                      transition={{ duration: 0.35 }}
                      className="be-gradient-text inline-block"
                    >
                      {WORDS[word]}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-2">
                Rotas, visitas, encomendas, cobranças e auditorias — da Baixa ao Zimpeto, com o que acontece em cada loja à vista do supervisor.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/criar-conta" variant="primary" size="lg" iconRight={ArrowRight}>
                  Criar conta grátis
                </ButtonLink>
                <ButtonLink href="#funcionalidades" variant="secondary" size="lg">
                  Ver funcionalidades
                </ButtonLink>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-ink-2">
                {['Sem instalar nada', 'Funciona no telemóvel', 'Backup diário'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-ok" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div initial={reduce ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
              <HeroScene />
            </motion.div>
          </div>
        </section>

        <ModuleMarquee />

        {/* ───────── Funcionalidades (vitrine interativa) ───────── */}
        <section id="funcionalidades" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
          <SectionTitle
            eyebrow="Funcionalidades"
            title={
              <>
                Tudo o que a operação precisa, <span className="text-brand-text">num só lugar</span>
              </>
            }
            text="Escolha um módulo para ver como funciona. Cada um tem a sua cor, para se orientar num instante."
          />
          <Reveal className="mt-10">
            <Showcase />
          </Reveal>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-6">
          <StatsBand />
        </section>

        {/* ───────── Como funciona ───────── */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
          <SectionTitle eyebrow="Como funciona" title="Do Excel à prateleira em 4 passos" color="var(--m-rotas-text)" />
          <div className="mt-10">
            <HowItWorks />
          </div>
        </section>

        {/* ───────── Para quem ───────── */}
        <section id="para-quem" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
          <SectionTitle eyebrow="Para quem" title="Um ecrã à medida de cada papel" text="Cada pessoa entra e vê logo o que precisa para o seu trabalho." color="var(--m-equipa-text)" />
          <div className="mt-10">
            <Roles />
          </div>
        </section>

        {/* ───────── Garantias ───────── */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionTitle eyebrow="Confiança" title="Rápida, segura e pensada para cá" color="var(--m-visitas-text)" />
          <div className="mt-10">
            <Trust />
          </div>
        </section>

        {/* ───────── Perguntas ───────── */}
        <section id="perguntas" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
          <SectionTitle eyebrow="Perguntas frequentes" title="Tem dúvidas? Nós respondemos" color="var(--m-dados-text)" />
          <div className="mt-10">
            <Faq />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pt-6 pb-20">
          <FinalCta />
        </section>
      </main>

      <Footer />
    </div>
    </MotionConfig>
  );
}

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReduceMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`sticky top-0 z-40 transition-[background,box-shadow,border-color] duration-300 ${scrolled || open ? 'border-b border-line bg-bg/80 backdrop-blur-lg' : 'border-b border-transparent'}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <a href="#" className="flex items-center gap-2.5" aria-label="BucketEgg — início">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight text-ink">
            Bucket<span className="text-brand-text">Egg</span>
          </span>
        </a>
        <nav aria-label="Secções" className="hidden items-center gap-1 md:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeButton />
          <span className="hidden sm:inline-flex">
            <ButtonLink href="/entrar" variant="ghost">
              Entrar
            </ButtonLink>
          </span>
          <span className="hidden sm:inline-flex">
            <ButtonLink href="/criar-conta" variant="primary" iconRight={ArrowRight}>
              Começar
            </ButtonLink>
          </span>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 md:hidden"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            aria-controls="menu-movel"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.nav
            id="menu-movel"
            aria-label="Secções"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden md:hidden"
          >
            <div className="grid gap-1 px-6 pb-4">
              {NAV.map(([label, href]) => (
                <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-semibold text-ink hover:bg-surface-2">
                  {label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
                <ButtonLink href="/entrar" variant="secondary">
                  Entrar
                </ButtonLink>
                <ButtonLink href="/criar-conta" variant="primary" iconRight={ArrowRight}>
                  Começar
                </ButtonLink>
              </div>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/** Alterna claro/escuro (a escolha fica guardada; o resto da app segue a mesma). */
function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemDark(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className="inline-flex size-10 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {dark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
    </button>
  );
}
