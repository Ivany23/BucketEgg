import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OutletStatus, Prisma, Role, TaskStatus } from '@prisma/client';
import { AccessService } from '../common/access.service.js';
import type { AuthUser } from '../common/types.js';
import { zonedDayRange } from '../common/utils/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateTaskDto, ListRoutesQueryDto, PlanRouteDto, UpdateTaskDto } from './dto/route.dto.js';
import { RouteOptimizerService } from './route-optimizer.service.js';

const DEFAULT_SERVICE_MINS = 15;

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly optimizer: RouteOptimizerService,
  ) {}

  /**
   * Cria a rota do dia: valida tenant/promotor/lojas, otimiza a ordem das visitas
   * (Google Routes API ou algoritmo local) e gera uma Task por paragem com ETA.
   */
  async planAndOptimizeRoute(user: AuthUser, dto: PlanRouteDto) {
    await this.access.project(user, dto.projectId);
    await this.access.member(user, dto.assigneeId);
    if (dto.beatId) {
      const beat = await this.prisma.beat.findFirst({ where: { id: dto.beatId, projectId: dto.projectId } });
      if (!beat) throw new BadRequestException('Beat não pertence a este projeto.');
    }

    const outlets = await this.prisma.outlet.findMany({
      where: { id: { in: dto.outletIds }, projectId: dto.projectId },
    });
    if (outlets.length !== dto.outletIds.length) {
      throw new BadRequestException('Algumas lojas não existem neste projeto.');
    }
    const inactive = outlets.filter((o) => o.status !== OutletStatus.ACTIVE);
    if (inactive.length) {
      throw new BadRequestException(`Lojas não ativas: ${inactive.map((o) => o.name).join(', ')}`);
    }
    const withGps = outlets.filter((o) => o.latitude != null && o.longitude != null);
    const withoutGps = outlets.filter((o) => o.latitude == null || o.longitude == null);
    if (!withGps.length) throw new BadRequestException('Nenhuma das lojas tem coordenadas GPS válidas.');

    const optimized = await this.optimizer.optimize(
      withGps.map((o) => ({ lat: o.latitude, lng: o.longitude })),
      dto.startLocation,
      dto.endLocation,
    );

    const start = new Date(dto.date);
    const serviceMins = dto.serviceMinsPerStop ?? DEFAULT_SERVICE_MINS;
    // Lojas sem GPS entram no fim da rota, pela ordem recebida.
    const ordered = [...optimized.order.map((i) => withGps[i]), ...withoutGps];
    // Sem destino nem partida, a rota termina na última loja com GPS da ordem otimizada.
    const lastGps = withGps[optimized.order.at(-1)];
    let clock = start.getTime();

    return this.prisma.$transaction(async (tx) => {
      const route = await tx.route.create({
        data: {
          name: dto.name,
          date: start,
          projectId: dto.projectId,
          assigneeId: dto.assigneeId,
          beatId: dto.beatId,
          startLat: dto.startLocation?.lat ?? ordered[0].latitude,
          startLng: dto.startLocation?.lng ?? ordered[0].longitude,
          endLat: dto.endLocation?.lat ?? dto.startLocation?.lat ?? lastGps.latitude,
          endLng: dto.endLocation?.lng ?? dto.startLocation?.lng ?? lastGps.longitude,
          totalDistance: optimized.totalDistanceKm,
          estimatedMins: optimized.totalTravelMins + serviceMins * ordered.length,
          optimizedBy: optimized.optimizedBy,
        },
      });

      await tx.task.createMany({
        data: ordered.map((outlet, idx) => {
          clock += (optimized.legMins[idx] ?? 0) * 60_000;
          const estArrival = new Date(clock);
          clock += serviceMins * 60_000;
          return {
            projectId: dto.projectId,
            routeId: route.id,
            outletId: outlet.id,
            assigneeId: dto.assigneeId,
            orderIndex: idx + 1,
            dueDate: start,
            estArrival,
          };
        }),
      });

      return tx.route.findUnique({
        where: { id: route.id },
        include: { tasks: { orderBy: { orderIndex: 'asc' }, include: { outlet: true } } },
      });
    });
  }

  async list(user: AuthUser, projectId: string, q: ListRoutesQueryDto) {
    await this.access.project(user, projectId);
    const where: Prisma.RouteWhereInput = { projectId, assigneeId: q.assigneeId, ...this.access.ownFilter(user, 'assigneeId') };
    if (q.date) {
      const { start, end } = zonedDayRange(q.date, await this.access.timezone(user));
      where.date = { gte: start, lt: end };
    }
    const routes = await this.prisma.route.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        tasks: { select: { status: true } },
      },
    });
    return routes.map(({ tasks, ...r }) => ({
      ...r,
      stops: tasks.length,
      completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
    }));
  }

  async getRouteDetails(user: AuthUser, routeId: string) {
    const route = await this.prisma.route.findFirst({
      where: { id: routeId, project: { organizationId: this.access.orgId(user) } },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        tasks: {
          orderBy: { orderIndex: 'asc' },
          include: { outlet: true, visits: { select: { id: true, checkInAt: true, checkOutAt: true } } },
        },
      },
    });
    if (!route) throw new NotFoundException('Rota não encontrada.');
    if (user.role === Role.FIELD_REP && route.assigneeId !== user.sub) {
      throw new ForbiddenException('Esta rota não lhe está atribuída.');
    }
    return route;
  }

  async deleteRoute(user: AuthUser, routeId: string) {
    const route = await this.getRouteDetails(user, routeId);
    await this.prisma.$transaction([
      // Paragens ainda não executadas deixam de fazer sentido sem a rota.
      this.prisma.task.deleteMany({ where: { routeId: route.id, status: TaskStatus.PENDING } }),
      this.prisma.route.delete({ where: { id: route.id } }),
    ]);
    return { deleted: true };
  }

  /** Plano do dia do utilizador autenticado (dia no fuso da organização): tarefas ordenadas com loja e estado. */
  async myDay(user: AuthUser, date?: string) {
    const { day, start, end } = zonedDayRange(date, await this.access.timezone(user));
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: user.sub,
        dueDate: { gte: start, lt: end },
        project: { organizationId: this.access.orgId(user) },
      },
      orderBy: [{ routeId: 'asc' }, { orderIndex: 'asc' }],
      include: {
        outlet: true,
        route: { select: { id: true, name: true } },
        visits: { select: { id: true, checkInAt: true, checkOutAt: true } },
      },
    });
    const done = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    return { date: day, total: tasks.length, completed: done, tasks };
  }

  async createTask(user: AuthUser, projectId: string, dto: CreateTaskDto) {
    await this.access.project(user, projectId);
    await this.access.member(user, dto.assigneeId);
    const outlet = await this.access.outlet(user, dto.outletId);
    if (outlet.projectId !== projectId) throw new BadRequestException('A loja não pertence a este projeto.');
    return this.prisma.task.create({
      data: { ...dto, dueDate: await this.dueDate(user, dto.dueDate), projectId },
      include: { outlet: true },
    });
  }

  async updateTask(user: AuthUser, taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { organizationId: this.access.orgId(user) } },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    if (!this.access.isManager(user)) {
      if (task.assigneeId !== user.sub) throw new ForbiddenException('Esta tarefa não lhe está atribuída.');
      if (dto.dueDate) throw new ForbiddenException('Só gestores podem reagendar tarefas.');
    }
    return this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status, notes: dto.notes, dueDate: dto.dueDate ? await this.dueDate(user, dto.dueDate) : undefined },
    });
  }

  /** "AAAA-MM-DD" = início desse dia no fuso da organização (aparece no "o meu dia" desse dia). */
  private async dueDate(user: AuthUser, value: string): Promise<Date> {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? zonedDayRange(value, await this.access.timezone(user)).start : new Date(value);
  }
}
