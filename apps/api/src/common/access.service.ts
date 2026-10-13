import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { DATA_ROLES, MANAGEMENT_ROLES } from './decorators/roles.decorator.js';
import type { AuthUser } from './types.js';
import { safeTimeZone } from './utils/dates.js';

const TIMEZONE_TTL_MS = 60_000;

/**
 * Centraliza o isolamento multi-tenant: qualquer recurso pedido por ID é sempre
 * confirmado como pertencente à organização ativa do utilizador. Recursos de outra
 * organização devolvem 404 (não revelamos que existem).
 */
@Injectable()
export class AccessService {
  private readonly timezones = new Map<string, { value: string; expires: number }>();

  constructor(private readonly prisma: PrismaService) {}

  orgId(user: AuthUser): string {
    if (!user?.organizationId) {
      throw new ForbiddenException('Crie ou selecione uma organização primeiro.');
    }
    return user.organizationId;
  }

  isManager(user: AuthUser): boolean {
    return !!user.role && MANAGEMENT_ROLES.includes(user.role);
  }

  /** Supervisores e analistas: podem ver e corrigir todos os dados recolhidos. */
  canEditData(user: AuthUser): boolean {
    return !!user.role && DATA_ROLES.includes(user.role);
  }

  async project(user: AuthUser, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: this.orgId(user) },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return project;
  }

  async outlet(user: AuthUser, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, project: { organizationId: this.orgId(user) } },
    });
    if (!outlet) throw new NotFoundException('Cliente/loja não encontrado.');
    return outlet;
  }

  /** Confirma que `userId` é membro ativo da organização (ex.: ao atribuir rotas). */
  async member(user: AuthUser, userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, organizationId: this.orgId(user), isActive: true, user: { isActive: true } },
    });
    if (!membership) throw new BadRequestException('O utilizador indicado não é membro ativo da organização.');
    return membership;
  }

  /** Promotores só podem agir em nome próprio; gestores podem agir por qualquer membro. */
  async resolveActor(user: AuthUser, requestedUserId?: string): Promise<string> {
    if (!requestedUserId || requestedUserId === user.sub) return user.sub;
    if (!this.isManager(user)) throw new ForbiddenException('Só pode registar atividade em nome próprio.');
    await this.member(user, requestedUserId);
    return requestedUserId;
  }

  /**
   * Fuso horário da organização (ex.: "Africa/Maputo"), para que "hoje" e "08:00" sejam a hora local.
   * Guardado 60 s em memória: muda raramente e "o meu dia" é pedido a toda a hora.
   */
  async timezone(user: AuthUser): Promise<string> {
    const orgId = this.orgId(user);
    const cached = this.timezones.get(orgId);
    if (cached && cached.expires > Date.now()) return cached.value;
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
    const value = safeTimeZone(org?.timezone);
    this.timezones.set(orgId, { value, expires: Date.now() + TIMEZONE_TTL_MS });
    return value;
  }

  /** Filtro de visibilidade: FIELD_REP só vê o que lhe está atribuído. */
  ownFilter(user: AuthUser, field = 'userId'): Record<string, string> {
    return user.role === Role.FIELD_REP ? { [field]: user.sub } : {};
  }
}
