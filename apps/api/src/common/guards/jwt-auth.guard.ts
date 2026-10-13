import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service.js';
import { AccessState, AuthCacheService } from '../auth-cache.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthUser } from '../types.js';

/**
 * Guard global: valida o Bearer token e confirma que o utilizador e a membership
 * continuam ativos (um token emitido antes de uma desativação deixa de funcionar).
 * Uma única consulta à base de dados, com cache curto (ver AuthCacheService).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cache: AuthCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token não encontrado na requisição.');
    }

    let payload: AuthUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    const state = await this.accessState(payload);
    if (!state.userActive) throw new UnauthorizedException('Conta desativada ou inexistente.');
    if (payload.membershipId) {
      if (!state.membershipActive || state.organizationId !== payload.organizationId) {
        throw new UnauthorizedException('Acesso à organização revogado.');
      }
      // O papel pode ter mudado depois da emissão do token: usa sempre o atual.
      payload.role = state.role;
    }

    request.user = payload;
    return true;
  }

  private async accessState(payload: AuthUser): Promise<AccessState> {
    const key = `${payload.sub}|${payload.membershipId ?? ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        isActive: true,
        memberships: payload.membershipId
          ? { where: { id: payload.membershipId }, select: { isActive: true, role: true, organizationId: true } }
          : false,
      },
    });
    const membership = user?.memberships?.[0];
    const state: AccessState = {
      userActive: !!user?.isActive,
      membershipActive: !!membership?.isActive,
      organizationId: membership?.organizationId ?? null,
      role: membership?.role ?? null,
    };
    this.cache.set(key, state);
    return state;
  }
}
