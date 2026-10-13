import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

export interface AccessState {
  userActive: boolean;
  membershipActive: boolean;
  organizationId: string | null;
  role: Role | null;
}

const MAX_ENTRIES = 50_000;

/**
 * Cache curto (por instância) do estado de acesso de cada token: evita uma consulta à base de
 * dados em CADA pedido. Alterações feitas nesta instância são invalidadas na hora; noutras
 * instâncias da API, demoram no máximo AUTH_CACHE_TTL_MS (10 s por defeito) a ter efeito.
 */
@Injectable()
export class AuthCacheService {
  private readonly ttlMs: number;
  private readonly entries = new Map<string, { value: AccessState; expiresAt: number }>();

  constructor(config: ConfigService) {
    this.ttlMs = Number(config.get('AUTH_CACHE_TTL_MS'));
  }

  get(key: string): AccessState | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: AccessState) {
    if (this.entries.size >= MAX_ENTRIES) {
      // Remove a entrada mais antiga (o Map preserva a ordem de inserção).
      this.entries.delete(this.entries.keys().next().value);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Invalida todas as entradas de um utilizador e/ou de uma membership. */
  invalidate({ userId, membershipId }: { userId?: string; membershipId?: string }) {
    for (const key of this.entries.keys()) {
      const [u, m] = key.split('|');
      if ((userId && u === userId) || (membershipId && m === membershipId)) this.entries.delete(key);
    }
  }
}
