import { Injectable } from '@nestjs/common';
import { AccessService } from '../common/access.service.js';
import type { AuthUser } from '../common/types.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';

const projectCounts = {
  _count: { select: { datasets: true, outlets: true, beats: true, routes: true, orders: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  create(user: AuthUser, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { ...dto, organizationId: this.access.orgId(user) },
    });
  }

  findAll(user: AuthUser, includeArchived = false) {
    return this.prisma.project.findMany({
      where: { organizationId: this.access.orgId(user), ...(includeArchived ? {} : { isArchived: false }) },
      include: projectCounts,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    await this.access.project(user, id);
    return this.prisma.project.findUnique({ where: { id }, include: projectCounts });
  }

  async update(user: AuthUser, id: string, dto: UpdateProjectDto) {
    await this.access.project(user, id);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(user: AuthUser, id: string) {
    await this.access.project(user, id);
    await this.prisma.project.delete({ where: { id } });
    return { deleted: true };
  }
}
