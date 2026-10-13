import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../types.js';

/** Injeta o utilizador autenticado (payload do JWT). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
