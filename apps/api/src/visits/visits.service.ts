import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OutletStatus, Prisma, TaskStatus } from '@prisma/client';
import { AccessService } from '../common/access.service.js';
import { paginate } from '../common/dto/pagination.dto.js';
import type { AuthUser } from '../common/types.js';
import { zonedPeriodRange } from '../common/utils/dates.js';
import { haversineMeters } from '../common/utils/geo.js';
import { PrismaService } from '../database/prisma.service.js';
import { CheckInDto, CheckOutDto, ListVisitsQueryDto } from './dto/visit.dto.js';

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async checkIn(user: AuthUser, dto: CheckInDto) {
    const outlet = await this.access.outlet(user, dto.outletId);
    if (outlet.status === OutletStatus.REJECTED || outlet.status === OutletStatus.INACTIVE) {
      throw new BadRequestException('Esta loja não está ativa.');
    }

    const open = await this.prisma.visit.findFirst({ where: { userId: user.sub, checkOutAt: null } });
    if (open) {
      throw new ConflictException({ message: 'Já tem uma visita em curso. Faça check-out primeiro.', visitId: open.id });
    }

    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({ where: { id: dto.taskId, outletId: outlet.id } });
      if (!task) throw new BadRequestException('A tarefa não corresponde a esta loja.');
      if (task.assigneeId !== user.sub) throw new BadRequestException('Esta tarefa não lhe está atribuída.');
    }

    const org = await this.prisma.organization.findUnique({ where: { id: this.access.orgId(user) } });
    const here = { lat: dto.lat, lng: dto.lng };
    const hasOutletGps = outlet.latitude != null && outlet.longitude != null;
    const distanceM = hasOutletGps
      ? Math.round(haversineMeters(here, { lat: outlet.latitude, lng: outlet.longitude }))
      : null;
    // Fora do raio a visita é registada mas sinalizada para o supervisor (não bloqueia o promotor).
    const withinGeofence = distanceM === null || distanceM <= org.geofenceRadiusM;

    return this.prisma.$transaction(async (tx) => {
      if (!hasOutletGps) {
        // Primeira visita a uma loja sem GPS: geo-referencia a loja.
        await tx.outlet.update({ where: { id: outlet.id }, data: { latitude: dto.lat, longitude: dto.lng } });
      }
      if (dto.taskId) {
        await tx.task.update({ where: { id: dto.taskId }, data: { status: TaskStatus.IN_PROGRESS } });
      }
      return tx.visit.create({
        data: {
          projectId: outlet.projectId,
          outletId: outlet.id,
          userId: user.sub,
          taskId: dto.taskId,
          checkInLat: dto.lat,
          checkInLng: dto.lng,
          distanceM,
          withinGeofence,
        },
        include: { outlet: { select: { id: true, name: true } } },
      });
    });
  }

  async checkOut(user: AuthUser, visitId: string, dto: CheckOutDto) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, userId: user.sub, project: { organizationId: this.access.orgId(user) } },
      include: { _count: { select: { orders: true } } },
    });
    if (!visit) throw new NotFoundException('Visita não encontrada.');
    if (visit.checkOutAt) throw new ConflictException('Esta visita já foi encerrada.');

    const now = new Date();
    const isProductive = visit._count.orders > 0;
    if (!isProductive && !dto.noOrderReason) {
      throw new BadRequestException('Indique o motivo de não haver encomenda (noOrderReason).');
    }

    return this.prisma.$transaction(async (tx) => {
      if (visit.taskId) {
        await tx.task.update({ where: { id: visit.taskId }, data: { status: TaskStatus.COMPLETED } });
      }
      await tx.outlet.update({ where: { id: visit.outletId }, data: { lastVisitedAt: visit.checkInAt } });
      return tx.visit.update({
        where: { id: visit.id },
        data: {
          checkOutAt: now,
          checkOutLat: dto.lat,
          checkOutLng: dto.lng,
          durationMins: Math.round((now.getTime() - visit.checkInAt.getTime()) / 60_000),
          isProductive,
          noOrderReason: isProductive ? null : dto.noOrderReason,
          notes: dto.notes,
          photoUrls: dto.photoUrls,
        },
      });
    });
  }

  active(user: AuthUser) {
    return this.prisma.visit.findFirst({
      where: { userId: user.sub, checkOutAt: null, project: { organizationId: this.access.orgId(user) } },
      include: { outlet: true },
    });
  }

  async list(user: AuthUser, projectId: string, q: ListVisitsQueryDto) {
    await this.access.project(user, projectId);
    const { start, end } = zonedPeriodRange(q.from, q.to, await this.access.timezone(user));
    const where: Prisma.VisitWhereInput = {
      projectId,
      outletId: q.outletId,
      userId: q.userId,
      checkInAt: { gte: start, lt: end },
      ...this.access.ownFilter(user),
    };
    const [items, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        orderBy: { checkInAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          outlet: { select: { id: true, name: true, zone: true } },
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.visit.count({ where }),
    ]);
    return paginate(items, total, q);
  }
}
