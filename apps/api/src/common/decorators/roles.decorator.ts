import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restringe o endpoint aos papéis indicados na organização ativa.
 * Sem este decorator, basta estar autenticado (os serviços validam a organização).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const ALL_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.ANALYST, Role.FIELD_REP];
/** Gerem equipa, planeamento e operação no terreno. */
export const MANAGEMENT_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER];
/** Podem consultar todos os dados, corrigi-los e exportá-los (o auditor FIELD_REP só recolhe). */
export const DATA_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.ANALYST];
export const ADMIN_ROLES: Role[] = [Role.OWNER, Role.ADMIN];
/** Papéis que podem ser supervisores de outros membros. */
export const SUPERVISOR_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER];
