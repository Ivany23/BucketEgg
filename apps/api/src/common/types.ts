import { Role } from '@prisma/client';

/** Payload do JWT, injetado em `request.user` pelo JwtAuthGuard. */
export interface AuthUser {
  sub: string;
  email: string;
  /** Organização (tenant) ativa. `null` quando o utilizador ainda não criou/aderiu a uma organização. */
  organizationId: string | null;
  membershipId: string | null;
  role: Role | null;
}
