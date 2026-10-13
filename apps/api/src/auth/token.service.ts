import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthUser } from '../common/types.js';

/** Emite tokens JWT para um utilizador no contexto de uma organização (tenant). */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Gera a sessão. Se `organizationId` não for indicado usa a primeira organização ativa
   * do utilizador; se não tiver nenhuma, o token é emitido sem tenant (onboarding).
   */
  async issue(userId: string, organizationId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) throw new UnauthorizedException('Conta desativada ou inexistente.');

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        isActive: true,
        ...(organizationId ? { organizationId } : {}),
      },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    if (organizationId && !membership) {
      throw new UnauthorizedException('Não pertence a esta organização.');
    }

    const payload: AuthUser = {
      sub: user.id,
      email: user.email,
      organizationId: membership?.organizationId ?? null,
      membershipId: membership?.id ?? null,
      role: membership?.role ?? null,
    };

    return {
      access_token: await this.jwt.signAsync({ ...payload }),
      user: { id: user.id, email: user.email, name: user.name },
      organization: membership
        ? { id: membership.organization.id, name: membership.organization.name, role: membership.role }
        : null,
      needsOnboarding: !membership,
    };
  }
}
