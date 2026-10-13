import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AccessService } from '../common/access.service.js';
import type { AuthUser } from '../common/types.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto.js';

function slugify(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${randomBytes(3).toString('hex')}`;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Cria a organização e torna o utilizador OWNER. Aceita um cliente de transação. */
  createWithOwner(db: Prisma.TransactionClient, userId: string, dto: CreateOrganizationDto) {
    return db.organization.create({
      data: {
        ...dto,
        slug: slugify(dto.name),
        memberships: { create: { userId, role: Role.OWNER } },
      },
    });
  }

  create(user: AuthUser, dto: CreateOrganizationDto) {
    return this.createWithOwner(this.prisma, user.sub, dto);
  }

  /** Organizações a que o utilizador pertence (nunca lista as de outros tenants). */
  listMine(user: AuthUser) {
    return this.prisma.organization.findMany({
      where: { memberships: { some: { userId: user.sub, isActive: true } } },
      include: {
        memberships: { where: { userId: user.sub }, select: { role: true } },
        _count: { select: { projects: true, memberships: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async current(user: AuthUser) {
    const org = await this.prisma.organization.findUnique({
      where: { id: this.access.orgId(user) },
      include: { _count: { select: { projects: true, memberships: true, products: true } } },
    });
    if (!org) throw new NotFoundException('Organização não encontrada.');
    return org;
  }

  update(user: AuthUser, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({ where: { id: this.access.orgId(user) }, data: dto });
  }
}
