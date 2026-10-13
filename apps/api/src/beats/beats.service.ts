import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OutletStatus } from '@prisma/client';
import { AccessService } from '../common/access.service.js';
import type { AuthUser } from '../common/types.js';
import { zonedDateTime, zonedDayRange } from '../common/utils/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import { RoutesService } from '../routes/routes.service.js';
import { CreateBeatDto, GenerateRoutesDto, UpdateBeatDto } from './dto/beat.dto.js';

const beatInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  outlets: { orderBy: { orderIndex: 'asc' as const }, include: { outlet: true } },
};

@Injectable()
export class BeatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly routes: RoutesService,
  ) {}

  async create(user: AuthUser, projectId: string, dto: CreateBeatDto) {
    await this.access.project(user, projectId);
    await this.validateRefs(user, projectId, dto);
    const { outletIds, ...data } = dto;
    return this.prisma.beat.create({
      data: {
        ...data,
        projectId,
        outlets: outletIds && { create: outletIds.map((outletId, orderIndex) => ({ outletId, orderIndex })) },
      },
      include: beatInclude,
    });
  }

  async list(user: AuthUser, projectId: string) {
    await this.access.project(user, projectId);
    return this.prisma.beat.findMany({
      where: { projectId, ...this.access.ownFilter(user, 'assigneeId') },
      include: { assignee: beatInclude.assignee, _count: { select: { outlets: true, routes: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const beat = await this.prisma.beat.findFirst({
      where: { id, project: { organizationId: this.access.orgId(user) } },
      include: beatInclude,
    });
    if (!beat) throw new NotFoundException('Beat não encontrado.');
    return beat;
  }

  async update(user: AuthUser, id: string, dto: UpdateBeatDto) {
    const beat = await this.findOne(user, id);
    await this.validateRefs(user, beat.projectId, dto);
    const { outletIds, ...data } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (outletIds) {
        await tx.beatOutlet.deleteMany({ where: { beatId: id } });
        await tx.beatOutlet.createMany({
          data: outletIds.map((outletId, orderIndex) => ({ beatId: id, outletId, orderIndex })),
        });
      }
      return tx.beat.update({ where: { id }, data, include: beatInclude });
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.findOne(user, id);
    await this.prisma.beat.delete({ where: { id } });
    return { deleted: true };
  }

  /** Gera a rota otimizada de um beat para um dia. */
  async generateRoute(user: AuthUser, id: string, dto: GenerateRoutesDto) {
    const beat = await this.findOne(user, id);
    // Uma rota por beat e por dia (como no plano do dia): evita rotas duplicadas para o promotor.
    const { start, end } = zonedDayRange(dto.date, await this.access.timezone(user));
    const existing = await this.prisma.route.findFirst({ where: { beatId: beat.id, date: { gte: start, lt: end } }, select: { id: true } });
    if (existing) {
      throw new ConflictException({ message: 'Este beat já tem uma rota para este dia.', routeId: existing.id });
    }
    return this.buildRoute(user, beat, dto);
  }

  /**
   * Plano de jornada automático: para cada beat agendado no dia da semana de `date`
   * e com promotor atribuído, cria a rota (se ainda não existir).
   */
  async generateDay(user: AuthUser, projectId: string, dto: GenerateRoutesDto) {
    await this.access.project(user, projectId);
    // Dia no fuso da organização; o dia da semana vem da própria data (0 = domingo).
    const { day, start, end } = zonedDayRange(dto.date, await this.access.timezone(user));
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const beats = await this.prisma.beat.findMany({
      where: { projectId, weekdays: { has: weekday }, assigneeId: { not: null } },
      include: beatInclude,
    });

    const created: { beatId: string; routeId: string }[] = [];
    const skipped: { beatId: string; reason: string }[] = [];
    for (const beat of beats) {
      const existing = await this.prisma.route.findFirst({
        where: { beatId: beat.id, date: { gte: start, lt: end } },
      });
      if (existing) {
        skipped.push({ beatId: beat.id, reason: 'rota já existe' });
        continue;
      }
      try {
        const route = await this.buildRoute(user, beat, dto);
        created.push({ beatId: beat.id, routeId: route.id });
      } catch (e) {
        skipped.push({ beatId: beat.id, reason: (e as Error).message });
      }
    }
    return { date: day, weekday, created, skipped };
  }

  private async buildRoute(
    user: AuthUser,
    beat: Awaited<ReturnType<BeatsService['findOne']>>,
    dto: GenerateRoutesDto,
  ) {
    if (!beat.assigneeId) throw new BadRequestException('O beat não tem promotor atribuído.');
    const outletIds = beat.outlets.filter((b) => b.outlet.status === OutletStatus.ACTIVE).map((b) => b.outletId);
    if (!outletIds.length) throw new BadRequestException('O beat não tem lojas ativas.');

    // "08:00" é a hora local da organização (ex.: 08:00 em Maputo = 06:00 UTC).
    const timeZone = await this.access.timezone(user);
    const { day } = zonedDayRange(dto.date, timeZone);
    const start = zonedDateTime(day, dto.startTime ?? '08:00', timeZone);

    return this.routes.planAndOptimizeRoute(user, {
      projectId: beat.projectId,
      assigneeId: beat.assigneeId,
      beatId: beat.id,
      name: `${beat.name} - ${day}`,
      date: start.toISOString(),
      outletIds,
      startLocation: dto.startLocation,
    });
  }

  private async validateRefs(user: AuthUser, projectId: string, dto: UpdateBeatDto) {
    if (dto.assigneeId) await this.access.member(user, dto.assigneeId);
    if (dto.outletIds?.length) {
      const count = await this.prisma.outlet.count({ where: { id: { in: dto.outletIds }, projectId } });
      if (count !== dto.outletIds.length) throw new BadRequestException('Algumas lojas não existem neste projeto.');
    }
  }
}
