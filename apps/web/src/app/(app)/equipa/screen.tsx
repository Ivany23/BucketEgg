'use client';

import { BarChart3, Crown, LayoutGrid, Network, ShieldCheck, UserCog, UserPlus, UserRound, Users, UserX } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Button, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton, StatTile, Tabs, cn, type TabItem } from '@/components/ui';
import { ROLE_ORDER, assignableRoles, branchColorMap } from '@/components/org/roles';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Member, Role } from '@/lib/types';
import { AddMemberModal } from './add-member-modal';
import { MemberCard } from './member-card';
import { MemberDrawer } from './member-drawer';
import { OrgChart } from './org-chart';

type RoleTab = 'all' | 'admins' | 'managers' | 'analysts' | 'reps';
type View = 'list' | 'chart';

const TAB_ROLES: Record<RoleTab, Role[] | null> = {
  all: null,
  admins: ['OWNER', 'ADMIN'],
  managers: ['MANAGER'],
  analysts: ['ANALYST'],
  reps: ['FIELD_REP'],
};

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function TeamScreen() {
  const { isManager, loading } = useSession();
  if (loading) return <Skeleton className="h-64" />;
  if (!isManager) {
    return (
      <div>
        <PageHeader icon={Users} title="Equipa" description="Membros, papéis e supervisores da organização." />
        <EmptyState
          illustration="team"
          title="Sem permissão para ver a equipa"
          description="A gestão da equipa está disponível para donos, administradores e supervisores. Se precisar de alterar algo, fale com o seu supervisor."
        />
      </div>
    );
  }
  return <TeamContent />;
}

function TeamContent() {
  const { organizationId, organizationName, me, role: myRole } = useSession();
  const reduce = useReducedMotion();
  const q = useApi<Member[]>(['team', organizationId], organizationId ? '/team' : null);
  const [tab, setTab] = useState<RoleTab>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const members = useMemo(() => q.data ?? [], [q.data]);
  const colors = useMemo(() => branchColorMap(members), [members]);
  const selected = members.find((m) => m.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const c = { all: members.length, admins: 0, managers: 0, analysts: 0, reps: 0 } satisfies Record<RoleTab, number>;
    for (const m of members) {
      if (m.role === 'OWNER' || m.role === 'ADMIN') c.admins++;
      else if (m.role === 'MANAGER') c.managers++;
      else if (m.role === 'ANALYST') c.analysts++;
      else c.reps++;
    }
    return c;
  }, [members]);

  const tabs: TabItem<RoleTab>[] = [
    { id: 'all', label: 'Todos', icon: Users, count: counts.all },
    { id: 'admins', label: 'Donos/Admins', icon: Crown, count: counts.admins },
    { id: 'managers', label: 'Supervisores', icon: UserCog, count: counts.managers },
    { id: 'analysts', label: 'Analistas', icon: BarChart3, count: counts.analysts },
    { id: 'reps', label: 'Promotores', icon: UserRound, count: counts.reps },
  ];

  const filtered = useMemo(() => {
    const roles = TAB_ROLES[tab];
    const term = normalize(search.trim());
    return members
      .filter((m) => !roles || roles.includes(m.role))
      .filter((m) => !term || normalize(`${m.user.name ?? ''} ${m.user.email} ${m.user.phone ?? ''}`).includes(term))
      .sort(
        (a, b) =>
          Number(b.isActive) - Number(a.isActive) ||
          ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
          (a.user.name ?? a.user.email).localeCompare(b.user.name ?? b.user.email, 'pt'),
      );
  }, [members, tab, search]);

  const active = members.filter((m) => m.isActive);
  const unassigned = active.filter((m) => m.role === 'FIELD_REP' && !m.supervisors.some((s) => active.some((a) => a.id === s.id))).length;
  const canAdd = assignableRoles(myRole).length > 0;

  return (
    <div>
      <PageHeader
        icon={Users}
        eyebrow={organizationName ?? undefined}
        title="Equipa"
        description="Quem faz parte da organização, o papel de cada pessoa e quem supervisiona quem."
        actions={
          canAdd ? (
            <Button variant="accent" icon={UserPlus} onClick={() => setAdding(true)}>
              Adicionar membro
            </Button>
          ) : null
        }
      />

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <TeamSkeleton />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile index={0} label="Membros ativos" value={active.length} icon={Users} color="var(--m-equipa)" hint={`${members.length - active.length} inativos`} />
            <StatTile index={1} label="Supervisores" value={active.filter((m) => m.role === 'MANAGER').length} icon={UserCog} color="var(--m-rotas)" />
            <StatTile index={2} label="Promotores" value={active.filter((m) => m.role === 'FIELD_REP').length} icon={UserRound} color="var(--m-visitas)" />
            <StatTile
              index={3}
              label="Sem supervisor"
              value={unassigned}
              icon={unassigned ? UserX : ShieldCheck}
              color={unassigned ? 'var(--warn)' : 'var(--ok)'}
              hint={unassigned ? 'Promotores por atribuir' : 'Todos têm supervisor'}
            />
          </div>

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {view === 'list' ? <Tabs tabs={tabs} value={tab} onChange={setTab} className="lg:max-w-[70%]" /> : <span className="hidden lg:block" />}
            <div className="flex items-center gap-2">
              {view === 'list' ? (
                <SearchInput value={search} onChange={setSearch} placeholder="Nome, email ou telefone…" label="Pesquisar membros" className="min-w-0 flex-1 lg:w-64" />
              ) : (
                <span className="flex-1" />
              )}
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {view === 'chart' ? (
              <motion.div key="chart" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <OrgChart members={members} colors={colors} organizationName={organizationName} onOpen={(m) => setSelectedId(m.id)} />
              </motion.div>
            ) : (
              <motion.div key="list" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {filtered.length === 0 ? (
                  <EmptyState
                    illustration={search ? 'search' : 'team'}
                    title={search ? 'Nenhum membro encontrado' : 'Ainda ninguém com este papel'}
                    description={search ? `Não há resultados para "${search}".` : 'Adicione membros para formar a equipa.'}
                    action={
                      search ? (
                        <Button onClick={() => setSearch('')}>Limpar pesquisa</Button>
                      ) : canAdd ? (
                        <Button variant="accent" icon={UserPlus} onClick={() => setAdding(true)}>
                          Adicionar membro
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Membros">
                    {filtered.map((m, i) => (
                      <motion.li
                        key={m.id}
                        layout={!reduce}
                        initial={reduce ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 10) * 0.035, type: 'spring', stiffness: 280, damping: 26 }}
                      >
                        <MemberCard member={m} isSelf={m.user.id === me?.id} colors={colors} onOpen={() => setSelectedId(m.id)} />
                      </motion.li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <AddMemberModal open={adding} onClose={() => setAdding(false)} members={members} colors={colors} onAdded={(m) => setSelectedId(m.id)} />
      <MemberDrawer member={selected} members={members} colors={colors} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const options: { id: View; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'list', label: 'Lista', icon: LayoutGrid },
    { id: 'chart', label: 'Organigrama', icon: Network },
  ];
  return (
    <div role="group" aria-label="Vista" className="inline-flex shrink-0 rounded-xl bg-surface-2 p-1">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cn(
              'relative inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors',
              on ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {on ? (
              <motion.span layoutId="team-view" className="shadow-soft absolute inset-0 rounded-lg bg-surface" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            ) : null}
            <o.icon className="relative size-4" style={on ? { color: 'var(--accent-text)' } : undefined} aria-hidden />
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div aria-busy="true" aria-label="A carregar a equipa">
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="mb-4 h-11 w-full max-w-xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
