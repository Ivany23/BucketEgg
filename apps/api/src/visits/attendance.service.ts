import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessService } from '../common/access.service.js';
import type { AuthUser } from '../common/types.js';
import { zonedCalendarDate } from '../common/utils/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import { ClockDto } from './dto/visit.dto.js';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async clockIn(user: AuthUser, dto: ClockDto) {
    await this.access.project(user, dto.projectId);
    // "Hoje" é o dia de Maputo (fuso da organização), não o dia UTC.
    const { date: start } = zonedCalendarDate(undefined, await this.access.timezone(user));
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_projectId_date: { userId: user.sub, projectId: dto.projectId, date: start } },
    });
    if (existing) throw new ConflictException('Já registou a entrada hoje.');
    return this.prisma.attendance.create({
      data: {
        userId: user.sub,
        projectId: dto.projectId,
        date: start,
        clockInLat: dto.lat,
        clockInLng: dto.lng,
        selfieUrl: dto.selfieUrl,
      },
    });
  }

  async clockOut(user: AuthUser, dto: ClockDto) {
    await this.access.project(user, dto.projectId);
    const { date: start } = zonedCalendarDate(undefined, await this.access.timezone(user));
    const record = await this.prisma.attendance.findUnique({
      where: { userId_projectId_date: { userId: user.sub, projectId: dto.projectId, date: start } },
    });
    if (!record) throw new NotFoundException('Não registou a entrada hoje.');
    if (record.clockOutAt) throw new ConflictException('Já registou a saída hoje.');
    return this.prisma.attendance.update({
      where: { id: record.id },
      data: { clockOutAt: new Date(), clockOutLat: dto.lat, clockOutLng: dto.lng },
    });
  }

  /**
   * Presenças do dia. Gestores veem toda a equipa (incluindo quem faltou);
   * promotores veem apenas o seu registo.
   */
  async day(user: AuthUser, projectId: string, date?: string) {
    await this.access.project(user, projectId);
    const { date: start } = zonedCalendarDate(date, await this.access.timezone(user));
    const records = await this.prisma.attendance.findMany({
      where: { projectId, date: start, ...this.access.ownFilter(user) },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!this.access.isManager(user)) return { date: start.toISOString().slice(0, 10), records };

    const reps = await this.prisma.membership.findMany({
      where: { organizationId: this.access.orgId(user), isActive: true, role: 'FIELD_REP' },
      select: { user: { select: { id: true, name: true, email: true } } },
    });
    const present = new Set(records.map((r) => r.userId));
    return {
      date: start.toISOString().slice(0, 10),
      present: records.length,
      absent: reps.filter((r) => !present.has(r.user.id)).map((r) => r.user),
      records,
    };
  }
}
