'use client';

import { Building2, Check, ChevronDown, FolderKanban, LogOut, Menu, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from '@/components/illustrations';
import { Avatar, Drawer, Skeleton, cn, useToast } from '@/components/ui';
import { ProjectProvider, useProject } from '@/lib/project';
import { useSession } from '@/lib/session';
import { useTheme, type ThemeChoice } from '@/lib/theme';
import { ROLE_LABEL } from '@/lib/types';
import { NAV, homeFor, mobileTabs, visibleNav, type NavItem } from './nav';

const allItems: NavItem[] = NAV.flatMap((s) => s.items);
const moduleFor = (pathname: string) => allItems.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.module ?? 'painel';

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Proteção: sem sessão vai para "Entrar"; sem organização vai para o onboarding.
  useEffect(() => {
    if (session.loading) return;
    if (!session.token) router.replace('/entrar');
    else if (session.me && !session.organizationId) router.replace('/bem-vindo');
  }, [session.loading, session.token, session.me, session.organizationId, router]);

  const ready = !session.loading && !!session.token && !!session.me && !!session.organizationId;

  // A página monta sempre (o servidor pré-desenha a sua casca estática); enquanto a sessão é lida
  // fica escondida atrás de esqueletos, para não mostrar estados errados ("sem permissão", "sem projetos").
  return (
    <ProjectProvider>
      <div className="flex min-h-dvh">
        {ready ? <Sidebar /> : <SidebarSkeleton />}
        <div className="flex min-w-0 flex-1 flex-col">
          {ready ? <Topbar /> : <div className="h-16 border-b border-line" />}
          <main data-module={moduleFor(pathname)} className="flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
            {ready ? (
              <PageTransition key={pathname}>{children}</PageTransition>
            ) : (
              <>
                <PageSkeleton />
                <div hidden>{children}</div>
              </>
            )}
          </main>
        </div>
        {ready ? <MobileNav /> : null}
      </div>
    </ProjectProvider>
  );
}

function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-7xl"
    >
      {children}
    </motion.div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="hidden w-64 shrink-0 border-r border-line bg-surface p-4 lg:block" aria-hidden>
      <Skeleton className="mb-8 h-10 w-36" />
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} className="mb-2 h-9" />
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl" aria-busy="true" aria-label="A carregar">
      <Skeleton className="mb-6 h-12 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72" />
    </div>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      data-module={item.module}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
        active ? 'text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {active ? (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl"
          style={{ background: 'var(--accent-soft)' }}
          transition={{ type: 'spring', stiffness: 450, damping: 36 }}
        />
      ) : null}
      <span
        className="relative inline-flex size-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
        style={{ color: 'var(--accent-text)', background: active ? 'transparent' : 'color-mix(in oklab, var(--accent) 12%, transparent)' }}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="relative">{item.label}</span>
    </Link>
  );
}

function NavSections({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useSession();
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-5">
      {visibleNav(role).map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-ink-3 uppercase">{section.title}</p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(`${item.href}/`)} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Sidebar() {
  const { role, organizationName } = useSession();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <Link href={homeFor(role)} className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <Logo />
        <div className="min-w-0">
          <p className="text-base leading-tight font-extrabold tracking-tight text-ink">
            Bucket<span className="text-brand-text">Egg</span>
          </p>
          <p className="truncate text-xs text-ink-3">{organizationName}</p>
        </div>
      </Link>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-6">
        <NavSections />
      </div>
    </aside>
  );
}

function ProjectSwitcher() {
  const { projects, project, setProjectId, loading } = useProject();
  if (loading) return <Skeleton className="h-10 w-48" />;
  if (!projects.length) {
    return (
      <Link href="/projetos" className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 text-sm font-semibold text-ink-2 hover:text-ink">
        <FolderKanban className="size-4" aria-hidden /> Criar o primeiro projeto
      </Link>
    );
  }
  return (
    <label className="relative inline-flex min-w-0 items-center">
      <span className="sr-only">Projeto ativo</span>
      <FolderKanban className="pointer-events-none absolute left-3 size-4 text-brand-text" aria-hidden />
      <select
        value={project?.id ?? ''}
        onChange={(e) => setProjectId(e.target.value)}
        className="h-10 max-w-[56vw] min-w-0 cursor-pointer appearance-none truncate rounded-xl border border-line bg-surface pr-9 pl-9 text-sm font-semibold text-ink outline-none hover:border-line-strong focus:border-brand sm:max-w-xs"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-ink-3" aria-hidden />
    </label>
  );
}

const themeOptions: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'Sistema', icon: Monitor },
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Escuro', icon: Moon },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = themeOptions.find((t) => t.id === theme) ?? themeOptions[0];
  const next = themeOptions[(themeOptions.indexOf(current) + 1) % themeOptions.length];
  const Icon = current.icon;
  return (
    <button
      type="button"
      onClick={() => setTheme(next.id)}
      aria-label={`Tema: ${current.label}. Mudar para ${next.label}`}
      title={`Tema: ${current.label}`}
      className="inline-flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={current.id} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
          <Icon className="size-[18px]" aria-hidden />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function UserMenu() {
  const session = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const me = session.me!;
  const switchTo = async (orgId: string) => {
    setOpen(false);
    try {
      await session.switchOrganization(orgId);
      toast.success('Organização alterada');
    } catch (e) {
      toast.error('Não foi possível mudar de organização', (e as Error).message);
    }
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2"
      >
        <Avatar name={me.name} email={me.email} size={32} />
        <span className="hidden text-left md:block">
          <span className="block max-w-36 truncate text-sm leading-tight font-semibold text-ink">{me.name ?? me.email}</span>
          <span className="block text-xs text-ink-3">{session.role ? ROLE_LABEL[session.role] : ''}</span>
        </span>
        <ChevronDown className="hidden size-4 text-ink-3 md:block" aria-hidden />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="shadow-lift absolute right-0 z-30 mt-2 w-72 origin-top-right rounded-2xl border border-line bg-surface p-2"
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-bold text-ink">{me.name ?? 'Sem nome'}</p>
              <p className="truncate text-xs text-ink-3">{me.email}</p>
            </div>
            {me.memberships.length > 1 ? (
              <div className="border-t border-line py-1">
                <p className="px-3 pt-1 pb-1 text-[11px] font-bold tracking-wider text-ink-3 uppercase">Organizações</p>
                {me.memberships.map((m) => (
                  <button
                    key={m.id}
                    role="menuitem"
                    type="button"
                    onClick={() => m.organization.id !== session.organizationId && switchTo(m.organization.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                  >
                    <Building2 className="size-4 text-ink-3" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{m.organization.name}</span>
                    {m.organization.id === session.organizationId ? <Check className="size-4 text-ok" aria-label="ativa" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="border-t border-line pt-1">
              <Link role="menuitem" href="/definicoes" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface-2">
                <UserRound className="size-4 text-ink-3" aria-hidden /> O meu perfil
              </Link>
              <button role="menuitem" type="button" onClick={session.logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-bad hover:bg-bad-soft">
                <LogOut className="size-4" aria-hidden /> Sair
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Topbar() {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur-md sm:gap-3 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        aria-label="Abrir menu"
        className="inline-flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <span className="lg:hidden">
        <Logo className="size-8" />
      </span>
      <ProjectSwitcher />
      <div className="flex-1" />
      <ThemeToggle />
      <UserMenu />
      <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu" subtitle="Todas as áreas da BucketEgg">
        <NavSections onNavigate={() => setMoreOpen(false)} />
      </Drawer>
    </header>
  );
}

function MobileNav() {
  const { role } = useSession();
  const pathname = usePathname();
  const tabs = mobileTabs(role)
    .map((href) => allItems.find((i) => i.href === href))
    .filter((i): i is NavItem => !!i);
  return (
    <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-md lg:hidden">
      <ul className="grid grid-cols-4">
        {tabs.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} data-module={item.module}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn('relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold', active ? 'text-[var(--accent-text)]' : 'text-ink-3')}
              >
                {active ? (
                  <motion.span layoutId="mobile-active" className="absolute inset-x-3 inset-y-0 rounded-xl" style={{ background: 'var(--accent-soft)' }} />
                ) : null}
                <Icon className="relative size-5" aria-hidden />
                <span className="relative">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
