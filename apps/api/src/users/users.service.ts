import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AccessService } from '../common/access.service.js';
import { AuthCacheService } from '../common/auth-cache.service.js';
import { SUPERVISOR_ROLES } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { PrismaService } from '../database/prisma.service.js';
import { AddMemberDto, UpdateMemberDto, UpdateProfileDto } from './dto/team.dto.js';

const personSelect = { select: { id: true, name: true, email: true } } as const;

const memberSelect = {
  id: true,
  role: true,
  isActive: true,
  createdAt: true,
  user: { select: { id: true, email: true, name: true, phone: true, isActive: true } },
  supervisors: { select: { supervisor: { select: { id: true, role: true, user: personSelect } } } },
  supervising: { select: { member: { select: { id: true, role: true, user: personSelect } } } },
} satisfies Prisma.MembershipSelect;

/** Papéis que cada papel pode atribuir ou gerir. */
const MANAGEABLE: Record<Role, Role[]> = {
  OWNER: [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.ANALYST, Role.FIELD_REP],
  ADMIN: [Role.ADMIN, Role.MANAGER, Role.ANALYST, Role.FIELD_REP],
  MANAGER: [Role.FIELD_REP],
  ANALYST: [],
  FIELD_REP: [],
};

type MemberRow = Prisma.MembershipGetPayload<{ select: typeof memberSelect }>;

/** Achata a relação N:N para uma resposta simples. */
function present(m: MemberRow) {
  const { supervisors, supervising, ...rest } = m;
  return {
    ...rest,
    supervisors: supervisors.map((s) => s.supervisor),
    supervising: supervising.map((s) => s.member),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly authCache: AuthCacheService,
  ) {}

  updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: user.sub },
      data: dto,
      select: { id: true, email: true, name: true, phone: true },
    });
  }

  async listMembers(user: AuthUser) {
    const members = await this.prisma.membership.findMany({
      where: { organizationId: this.access.orgId(user) },
      select: memberSelect,
      orderBy: { createdAt: 'asc' },
    });
    return members.map(present);
  }

  /** Membros que o utilizador autenticado supervisiona. */
  async myTeam(user: AuthUser) {
    const members = await this.prisma.membership.findMany({
      where: {
        organizationId: this.access.orgId(user),
        supervisors: { some: { supervisorId: user.membershipId } },
      },
      select: memberSelect,
      orderBy: { createdAt: 'asc' },
    });
    return members.map(present);
  }

  async addMember(user: AuthUser, dto: AddMemberDto) {
    const organizationId = this.access.orgId(user);
    this.assertCanManageRole(user, dto.role);

    // Um MANAGER que adiciona alguém sem indicar supervisores fica ele próprio como supervisor.
    const supervisorIds =
      dto.supervisorIds ?? (user.role === Role.MANAGER && user.membershipId ? [user.membershipId] : []);
    await this.validateSupervisors(organizationId, supervisorIds);

    let target = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (target) {
      const existing = await this.prisma.membership.findUnique({
        where: { userId_organizationId: { userId: target.id, organizationId } },
      });
      if (existing) throw new ConflictException('Este utilizador já é membro da organização.');
    } else if (!dto.password) {
      throw new BadRequestException('Indique uma palavra-passe inicial para criar a conta do novo membro.');
    }
    const passwordHash = target ? null : await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      target ??= await tx.user.create({
        data: { email: dto.email, name: dto.name, phone: dto.phone, password: passwordHash },
      });
      return tx.membership.create({
        data: {
          userId: target.id,
          organizationId,
          role: dto.role,
          supervisors: { create: supervisorIds.map((supervisorId) => ({ supervisorId })) },
        },
        select: memberSelect,
      });
    });
    return present(created);
  }

  async updateMember(user: AuthUser, membershipId: string, dto: UpdateMemberDto) {
    const organizationId = this.access.orgId(user);
    const member = await this.findMembership(organizationId, membershipId);

    // Só se pode gerir quem tem um papel que o próprio pode atribuir (ex.: MANAGER não mexe em ADMIN).
    this.assertCanManageRole(user, member.role);
    if (dto.role) this.assertCanManageRole(user, dto.role);

    const losesOwnership =
      member.role === Role.OWNER && ((dto.role && dto.role !== Role.OWNER) || dto.isActive === false);
    if (losesOwnership) {
      const owners = await this.prisma.membership.count({
        where: { organizationId, role: Role.OWNER, isActive: true },
      });
      if (owners <= 1) throw new BadRequestException('A organização precisa de pelo menos um OWNER ativo.');
    }

    if (dto.supervisorIds) {
      if (dto.supervisorIds.includes(membershipId)) {
        throw new BadRequestException('Um membro não pode ser supervisor de si próprio.');
      }
      await this.validateSupervisors(organizationId, dto.supervisorIds);
      // Evita ciclos diretos (A supervisiona B e B supervisiona A).
      const reverse = await this.prisma.membershipSupervisor.findFirst({
        where: { supervisorId: membershipId, memberId: { in: dto.supervisorIds } },
      });
      if (reverse) throw new BadRequestException('Este membro já supervisiona um dos supervisores indicados.');
    }

    const newRole = dto.role ?? member.role;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.supervisorIds) {
        await tx.membershipSupervisor.deleteMany({ where: { memberId: membershipId } });
        await tx.membershipSupervisor.createMany({
          data: dto.supervisorIds.map((supervisorId) => ({ memberId: membershipId, supervisorId })),
        });
      }
      // Quem deixa de ter papel de supervisor (ou é desativado) deixa de supervisionar alguém.
      if (!SUPERVISOR_ROLES.includes(newRole) || dto.isActive === false) {
        await tx.membershipSupervisor.deleteMany({ where: { supervisorId: membershipId } });
      }
      return tx.membership.update({
        where: { id: membershipId },
        data: { role: dto.role, isActive: dto.isActive },
        select: memberSelect,
      });
    });
    // Papel/estado novo tem efeito imediato nesta instância (nas outras, após o TTL do cache).
    this.authCache.invalidate({ membershipId });
    return present(updated);
  }

  async removeMember(user: AuthUser, membershipId: string) {
    if (membershipId === user.membershipId) throw new BadRequestException('Não pode remover-se a si próprio.');
    return this.updateMember(user, membershipId, { isActive: false });
  }

  private async findMembership(organizationId: string, membershipId: string) {
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, organizationId } });
    if (!m) throw new NotFoundException('Membro não encontrado.');
    return m;
  }

  /** Supervisores têm de ser membros ativos desta organização com papel de supervisão. */
  private async validateSupervisors(organizationId: string, ids: string[]) {
    if (!ids.length) return;
    const found = await this.prisma.membership.findMany({
      where: { id: { in: ids }, organizationId, isActive: true },
      select: { id: true, role: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('Algum supervisor indicado não é membro ativo da organização.');
    }
    const invalid = found.filter((m) => !SUPERVISOR_ROLES.includes(m.role));
    if (invalid.length) {
      throw new BadRequestException(`Só ${SUPERVISOR_ROLES.join(', ')} podem ser supervisores.`);
    }
  }

  private assertCanManageRole(user: AuthUser, role: Role) {
    if (!user.role || !MANAGEABLE[user.role].includes(role)) {
      throw new ForbiddenException(`Não tem permissão para gerir membros com o papel ${role}.`);
    }
  }
}
