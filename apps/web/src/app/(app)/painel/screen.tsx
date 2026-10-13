'use client';

import {
  ArrowRight,
  CalendarCheck,
  Clock,
  LayoutDashboard,
  MapPin,
  Plus,
  Route,
  ShoppingCart,
  Store,
  Table2,
  Target,
  Trophy,
  Upload,
  UserCheck,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { BarList, ChartTable, ColumnChart, LineChart, Ring, StackedBar } from '@/components/charts';
import { RequireProject } from '@/components/domain';
import { Avatar, Badge, Card, ErrorState, PageHeader, Skeleton, StatTile, Tabs, cn } from '@/components/ui';
import { compact, dateShort, int, minutes, money } from '@/lib/format';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Dashboard, Project, TrendPoint } from '@/lib/types';
import { addDays, useToday } from '@/lib/today';

type Period = '7' | '30' | '90';
const periods: { id: Period; label: string }[] = [
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
  { id: '90', label: '90 dias' },
];

export function DashboardScreen() {
  return <RequireProject>{(project) => <DashboardContent project={project} />}</RequireProject>;
}

function DashboardContent({ project }: { project: Project }) {
  const { me, isManager, canEditData } = useSession();
  const [period, setPeriod] = useState<Period>('30');
  const today = useToday();
  const range = useMemo(() => (today ? { from: addDays(today, -(Number(period) - 1)), to: today } : undefined), [period, today]);
  const dash = useApi<Dashboard>(['dashboard', project.id, period], range ? `/projects/${project.id}/analytics/dashboard` : null, range);
  const trend = useApi<TrendPoint[]>(['sales-trend', project.id, period], range ? `/projects/${project.id}/analytics/sales-trend` : null, range);
  const firstName = me?.name?.split(' ')[0];

  return (
    <div>
      <PageHeader
        icon={LayoutDashboard}
        eyebrow={project.name}
        title={firstName ? `Olá, ${firstName}` : 'Painel'}
        description="Plano vs. real, vendas, cobranças e o desempenho da equipa no período escolhido."
        actions={<Tabs tabs={periods} value={period} onChange={setPeriod} />}
      />

      {dash.isError ? (
        <ErrorState error={dash.error} onRetry={() => dash.refetch()} />
      ) : (
        <>
          <KpiGrid data={dash.data} />
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <TrendCard trend={trend.data} loading={trend.isPending} />
            <PlanCard data={dash.data} />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <LeaderboardCard data={dash.data} />
            <QuickActions isManager={isManager} canEditData={canEditData} />
          </div>
        </>
      )}
    </div>
  );
}

function KpiGrid({ data }: { data: Dashboard | undefined }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[118px]" />
        ))}
      </div>
    );
  }
  const tiles = [
    { label: 'Receita', value: data.sales.revenue, format: (v: number) => `${compact(v)} MZN`, icon: Wallet, color: 'var(--m-painel)', hint: `${money(data.sales.avgOrderValue)} por encomenda` },
    { label: 'Encomendas', value: data.sales.orders, icon: ShoppingCart, color: 'var(--m-vendas)', hint: 'no período' },
    { label: 'Visitas', value: data.visits.total, icon: MapPin, color: 'var(--m-visitas)', hint: `${data.visits.strikeRate.toLocaleString('pt-PT')}% com encomenda (strike rate)` },
    { label: 'Plano cumprido', value: data.planVsActual.completionRate, format: (v: number) => `${v.toFixed(1)}%`, icon: Target, color: 'var(--m-rotas)', hint: `${data.planVsActual.completed} de ${data.planVsActual.planned} paragens` },
    { label: 'Cobranças', value: data.collections.amount, format: (v: number) => `${compact(v)} MZN`, icon: Wallet, color: 'var(--m-lojas)', hint: `${data.collections.payments} pagamentos` },
    { label: 'Cobertura de lojas', value: data.outlets.coverage, format: (v: number) => `${v.toFixed(0)}%`, icon: Store, color: 'var(--m-beats)', hint: `${data.outlets.visited} de ${data.outlets.active} lojas ativas visitadas` },
    { label: 'Presenças hoje', value: data.attendanceToday, icon: UserCheck, color: 'var(--m-dia)', hint: 'promotores com entrada registada' },
    {
      label: 'Fora do geofence',
      value: data.visits.outsideGeofence,
      icon: Clock,
      color: 'var(--m-produtos)',
      hint: data.visits.avgDurationMins ? `duração média ${minutes(data.visits.avgDurationMins)}` : 'visitas longe da loja',
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t, i) => (
        <StatTile key={t.label} index={i} {...t} />
      ))}
    </div>
  );
}

function CardTitle({ icon: Icon, title, subtitle, color, action }: { icon: typeof Wallet; title: string; subtitle?: string; color: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {subtitle ? <p className="text-xs text-ink-3">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function TrendCard({ trend, loading }: { trend: TrendPoint[] | undefined; loading: boolean }) {
  const [asTable, setAsTable] = useState(false);
  const revenue = (trend ?? []).map((p) => ({ label: dateShort(`${p.date}T12:00:00Z`), value: p.revenue }));
  const orders = (trend ?? []).map((p) => ({ label: dateShort(`${p.date}T12:00:00Z`), value: p.orders }));
  const total = revenue.reduce((a, p) => a + p.value, 0);
  return (
    <Card className="p-5">
      <CardTitle
        icon={ShoppingCart}
        title="Receita por dia"
        subtitle={trend ? `${money(total)} no período` : undefined}
        color="var(--series-1)"
        action={
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-2"
          >
            <Table2 className="size-3.5" aria-hidden /> {asTable ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        }
      />
      {loading || !trend ? (
        <Skeleton className="h-[380px]" />
      ) : asTable ? (
        <ChartTable caption="Receita por dia" rows={revenue} valueLabel="Receita" format={money} />
      ) : (
        <>
          <LineChart data={revenue} format={money} ariaLabel={`Receita por dia: total ${money(total)}`} />
          <p className="mt-4 mb-2 text-sm font-semibold text-ink-2">Encomendas por dia</p>
          <ColumnChart data={orders} format={int} ariaLabel="Número de encomendas por dia" />
        </>
      )}
    </Card>
  );
}

function PlanCard({ data }: { data: Dashboard | undefined }) {
  return (
    <Card className="flex flex-col gap-6 p-5">
      <div>
        <CardTitle icon={Target} title="Plano vs. real" subtitle="Paragens planeadas nas rotas" color="var(--m-rotas)" />
        {data ? (
          <StackedBar
            ariaLabel={`Plano: ${data.planVsActual.completed} concluídas, ${data.planVsActual.pending} por visitar, ${data.planVsActual.missed} falhadas`}
            parts={[
              { label: 'Concluídas', value: data.planVsActual.completed, color: 'var(--ok)' },
              { label: 'Por visitar', value: data.planVsActual.pending, color: 'var(--m-rotas)' },
              { label: 'Falhadas', value: data.planVsActual.missed, color: 'var(--bad)' },
            ]}
          />
        ) : (
          <Skeleton className="h-16" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {data ? (
          <>
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2 p-4 text-center">
              <Ring value={data.visits.strikeRate} color="var(--m-visitas)" label="Strike rate" />
              <p className="text-xs font-semibold text-ink-2">Visitas com encomenda</p>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2 p-4 text-center">
              <Ring value={data.outlets.coverage} color="var(--m-beats)" label="Cobertura" />
              <p className="text-xs font-semibold text-ink-2">Lojas visitadas</p>
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </>
        )}
      </div>
      {data && data.outlets.pendingApproval > 0 ? (
        <Link href="/lojas" className="flex items-center justify-between rounded-2xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn hover:brightness-95">
          {data.outlets.pendingApproval} {data.outlets.pendingApproval === 1 ? 'loja aguarda' : 'lojas aguardam'} aprovação
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </Card>
  );
}

function LeaderboardCard({ data }: { data: Dashboard | undefined }) {
  const medals = ['#f59e0b', '#94a3b8', '#d97706'];
  return (
    <Card className="p-5">
      <CardTitle icon={Trophy} title="Ranking da equipa" subtitle="Receita por promotor no período" color="var(--m-dia)" />
      {!data ? (
        <Skeleton className="h-56" />
      ) : data.leaderboard.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">Ainda sem visitas no período.</p>
      ) : (
        <BarList
          format={(v) => `${compact(v)} MZN`}
          items={data.leaderboard.map((row, i) => ({
            id: row.user.id,
            value: row.revenue,
            label: (
              <span className="flex items-center gap-2">
                <span className="relative">
                  <Avatar name={row.user.name} email={row.user.email} size={30} />
                  {i < 3 ? (
                    <span aria-label={`${i + 1}.º lugar`} className="absolute -right-1 -bottom-1 inline-flex size-4 items-center justify-center rounded-full text-[9px] font-extrabold text-[#1a1208]" style={{ background: medals[i] }}>
                      {i + 1}
                    </span>
                  ) : null}
                </span>
                <span className="truncate font-semibold text-ink">{row.user.name ?? row.user.email}</span>
              </span>
            ),
            extra: (
              <span className="flex flex-wrap gap-x-3">
                <span>{row.visits} visitas</span>
                <span>{row.orders} encomendas</span>
                <Badge tone={row.strikeRate >= 60 ? 'ok' : row.strikeRate >= 40 ? 'warn' : 'bad'}>{row.strikeRate.toLocaleString('pt-PT')}% strike rate</Badge>
              </span>
            ),
          }))}
        />
      )}
    </Card>
  );
}

function QuickActions({ isManager, canEditData }: { isManager: boolean; canEditData: boolean }) {
  const actions = [
    isManager && { href: '/rotas', label: 'Planear rota', text: 'Otimizada pela Google Maps', icon: Route, color: 'var(--m-rotas)' },
    { href: '/meu-dia', label: 'O meu dia', text: 'Paragens, check-in e encomendas', icon: CalendarCheck, color: 'var(--m-dia)' },
    { href: '/lojas', label: 'Nova loja', text: 'Com deteção de duplicados', icon: Plus, color: 'var(--m-lojas)' },
    { href: '/encomendas', label: 'Nova encomenda', text: 'Preços do catálogo e Must Sell', icon: ShoppingCart, color: 'var(--m-vendas)' },
    canEditData && { href: '/importacoes', label: 'Importar Excel', text: 'Ficheiros de 300 000+ linhas', icon: Upload, color: 'var(--m-import)' },
  ].filter(Boolean) as { href: string; label: string; text: string; icon: typeof Route; color: string }[];
  return (
    <Card className="p-5">
      <CardTitle icon={ArrowRight} title="Atalhos" subtitle="O que costuma fazer a seguir" color="var(--m-painel)" />
      <div className="grid gap-2.5">
        {actions.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className={cn('group flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:shadow-soft')}
          >
            <span className="inline-flex size-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ background: `color-mix(in oklab, ${a.color} 16%, transparent)`, color: a.color }}>
              <a.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">{a.label}</span>
              <span className="block truncate text-xs text-ink-3">{a.text}</span>
            </span>
            <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        ))}
      </div>
    </Card>
  );
}
