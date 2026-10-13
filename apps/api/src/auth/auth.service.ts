import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import type { AuthUser } from '../common/types.js';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto.js';
import { TokenService } from './token.service.js';

export const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly organizations: OrganizationsService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Já existe uma conta com este email.');

    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const { userId, organizationId } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email, password, name: dto.name },
      });
      const org = dto.organizationName
        ? await this.organizations.createWithOwner(tx, user.id, { name: dto.organizationName })
        : null;
      return { userId: user.id, organizationId: org?.id };
    });

    return this.tokens.issue(userId, organizationId);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Compara sempre um hash, mesmo sem utilizador, para não revelar emails existentes pelo tempo de resposta.
    const hash = user?.password ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    let valid = false;
    if (user && !hash.startsWith('$2')) {
      // Migração: contas antigas guardavam a palavra-passe em texto simples.
      valid = hash === dto.password;
      if (valid) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS) },
        });
      }
    } else {
      valid = await bcrypt.compare(dto.password, hash);
    }

    if (!user || !valid) throw new UnauthorizedException('Credenciais inválidas.');
    if (!user.isActive) throw new UnauthorizedException('Conta desativada.');

    return this.tokens.issue(user.id, dto.organizationId);
  }

  async me(auth: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.sub },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        memberships: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    return { ...user, activeOrganizationId: auth.organizationId, activeRole: auth.role };
  }

  switchOrganization(auth: AuthUser, organizationId: string) {
    return this.tokens.issue(auth.sub, organizationId);
  }

  async changePassword(auth: AuthUser, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: auth.sub } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('A palavra-passe atual está incorreta.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    return { message: 'Palavra-passe alterada com sucesso.' };
  }
}
