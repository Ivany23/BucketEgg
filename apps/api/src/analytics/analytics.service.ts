import { Injectable } from '@nestjs/common';
import { OrderStatus, OutletStatus, TaskStatus } from '@prisma/client';
import { AccessService } from '../common/access.service.js';
import type { AuthUser } from '../common/types.js';
import { zonedCalendarDate, zonedPeriodRange } from '../common/utils/dates.js';
import { PrismaService } from '../database/prisma.service.js';

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
const round2 = (n: number) => Math.round((n ?? 0) * 100) / 100;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * KPIs de execução no período: plano vs real, strike rate (visitas produtivas),
   * vendas, cobranças, cobertura de lojas e leaderboard por promotor.
   * Tudo agregado no PostgreSQL (nunca carrega as visitas/encomendas para memória).
   * FIELD_REP recebe apenas os seus próprios números.
   */
  async dashboard(user: AuthUser, projectId: string, from?: string, to?: string) {
    await this.access.project(user, projectId);
    const timeZone = await this.access.timezone(user);
    const { start, end, days } = zonedPeriodRange(from, to, timeZone);
    const own = this.access.ownFilter(user);
    const ownTasks = this.access.ownFilter(user, 'assigneeId');
    const ownUserId = own.userId ?? null;
    const period = { gte: start, lt: end };
    const liveOrders = { projectId, createdAt: period, status: { not: OrderStatus.CANCELLED }, ...own };
    const visitWhere = { projectId, checkInAt: period, ...own };

    const [
      tasksByStatus,
      visitsByKind,
      avgDuration,
      orderAgg,
      payments,
      outletsByStatus,
      visitedOutlets,
      today,
      leaderboard,
    ] = await Promise.all([
      this.prisma.task.groupBy({ by: ['status'], where: { projectId, dueDate: period, ...ownTasks }, _count: true }),
      this.prisma.visit.groupBy({ by: ['isProductive', 'withinGeofence'], where: visitWhere, _count: true }),
      this.prisma.visit.aggregate({ where: { ...visitWhere, durationMins: { not: null } }, _avg: { durationMins: true } }),
      this.prisma.order.aggregate({ where: liveOrders, _sum: { total: true }, _count: true, _avg: { total: true } }),
      this.prisma.payment.aggregate({
        where: { outlet: { projectId }, createdAt: period, ...own },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.outlet.groupBy({ by: ['status'], where: { projectId }, _count: true }),
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(DISTINCT "outletId")::int AS n FROM visits
         WHERE "projectId" = ${projectId}
           AND "checkInAt" >= ${start.toISOString()}::timestamp AND "checkInAt" < ${end.toISOString()}::timestamp
           AND (${ownUserId}::text IS NULL OR "userId" = ${ownUserId})`,
      this.prisma.attendance.count({ where: { projectId, date: zonedCalendarDate(undefined, timeZone).date, ...own } }),
      this.leaderboard(projectId, period, own),
    ]);

    const taskCount = (st: TaskStatus) => tasksByStatus.find((t) => t.status === st)?._count ?? 0;
    const planned = tasksByStatus.reduce((sum, t) => sum + t._count, 0);
    const completed = taskCount(TaskStatus.COMPLETED);
    const totalVisits = visitsByKind.reduce((sum, v) => sum + v._count, 0);
    const productive = visitsByKind.filter((v) => v.isProductive).reduce((sum, v) => sum + v._count, 0);
    const outside = visitsByKind.filter((v) => !v.withinGeofence).reduce((sum, v) => sum + v._count, 0);
    const activeOutlets = outletsByStatus.find((o) => o.status === OutletStatus.ACTIVE)?._count ?? 0;
    const visited = visitedOutlets[0]?.n ?? 0;

    return {
      period: { from: days[0], to: days[days.length - 1] },
      planVsActual: {
        planned,
        completed,
        missed: taskCount(TaskStatus.MISSED),
        pending: taskCount(TaskStatus.PENDING) + taskCount(TaskStatus.IN_PROGRESS),
        completionRate: pct(completed, planned),
      },
      visits: {
        total: totalVisits,
        productive,
        strikeRate: pct(productive, totalVisits),
        outsideGeofence: outside,
        avgDurationMins: Math.round(avgDuration._avg.durationMins ?? 0),
      },
      sales: {
        orders: orderAgg._count,
        revenue: round2(orderAgg._sum.total),
        avgOrderValue: round2(orderAgg._avg.total),
      },
      collections: { payments: payments._count, amount: round2(payments._sum.amount) },
      outlets: {
        active: activeOutlets,
        pendingApproval: outletsByStatus.find((o) => o.status === OutletStatus.PENDING_APPROVAL)?._count ?? 0,
        visited,
        coverage: pct(visited, activeOutlets),
      },
      attendanceToday: today,
      leaderboard,
    };
  }

  /** Vendas por dia no período (para gráficos de tendência), agrupadas no PostgreSQL. */
  async salesTrend(user: AuthUser, projectId: string, from?: string, to?: string) {
    await this.access.project(user, projectId);
    const { start, end, days, timeZone } = zonedPeriodRange(from, to, await this.access.timezone(user));
    const ownUserId = this.access.ownFilter(user).userId ?? null;
    // createdAt é "timestamp sem fuso" em UTC: converte para o dia local da organização.
    const rows = await this.prisma.$queryRaw<{ day: string; orders: number; revenue: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS orders,
             COALESCE(SUM(total), 0)::float AS revenue
        FROM orders
       WHERE "projectId" = ${projectId}
         AND status <> 'CANCELLED'
         AND "createdAt" >= ${start.toISOString()}::timestamp AND "createdAt" < ${end.toISOString()}::timestamp
         AND (${ownUserId}::text IS NULL OR "userId" = ${ownUserId})
       GROUP BY 1`;
    const byDay = new Map(rows.map((r) => [r.day, r]));
    return days.map((date) => {
      const row = byDay.get(date);
      return { date, orders: row?.orders ?? 0, revenue: round2(row?.revenue ?? 0) };
    });
  }

  private async leaderboard(projectId: string, period: { gte: Date; lt: Date }, own: Record<string, string>) {
    const [visits, sales] = await Promise.all([
      this.prisma.visit.groupBy({
        by: ['userId', 'isProductive'],
        where: { projectId, checkInAt: period, ...own },
        _count: true,
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { projectId, createdAt: period, status: { not: OrderStatus.CANCELLED }, ...own },
        _sum: { total: true },
        _count: true,
      }),
    ]);
    const ids = new Set([...visits.map((v) => v.userId), ...sales.map((x) => x.userId)]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, name: true, email: true },
    });
    return users
      .map((u) => {
        const mine = visits.filter((v) => v.userId === u.id);
        const total = mine.reduce((sum, v) => sum + v._count, 0);
        const productive = mine.filter((v) => v.isProductive).reduce((sum, v) => sum + v._count, 0);
        const sold = sales.find((x) => x.userId === u.id);
        return {
          user: u,
          visits: total,
          productiveVisits: productive,
          strikeRate: pct(productive, total),
          orders: sold?._count ?? 0,
          revenue: round2(sold?._sum.total ?? 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.visits - a.visits);
  }
}
