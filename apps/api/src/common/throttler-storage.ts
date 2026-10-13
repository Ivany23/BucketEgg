import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

interface Window {
  hits: number;
  expiresAt: number;
  blockedUntil: number;
}

/**
 * Armazenamento do rate limit com custo constante por pedido (um contador por janela fixa).
 *
 * Porquê: o armazenamento por omissão do @nestjs/throttler guarda a hora de CADA pedido num array
 * e percorre-o em cada pedido novo. Medido neste projeto: com tráfego intenso a API caía de
 * ~10 000 para ~3 000 pedidos/s só por causa disso. Aqui cada pedido é um acesso a um Map.
 *
 * Nota: é por instância. Com várias instâncias da API, cada uma conta separadamente.
 */
@Injectable()
export class FastThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly windows = new Map<string, Window>();
  private readonly sweep: NodeJS.Timeout;

  constructor() {
    // Remove janelas expiradas uma vez por minuto (um único temporizador para todo o processo).
    this.sweep = setInterval(() => this.evict(), 60_000);
    this.sweep.unref();
  }

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    const now = Date.now();
    const id = `${throttlerName}:${key}`;
    let w = this.windows.get(id);
    if (!w) {
      w = { hits: 0, expiresAt: now + ttl, blockedUntil: 0 };
      this.windows.set(id, w);
    } else if (w.expiresAt <= now && w.blockedUntil <= now) {
      w.hits = 0;
      w.expiresAt = now + ttl;
      w.blockedUntil = 0;
    }

    if (w.blockedUntil <= now) {
      w.hits++;
      if (w.hits > limit) w.blockedUntil = now + blockDuration;
    }
    const isBlocked = w.blockedUntil > now;
    return {
      totalHits: w.hits,
      timeToExpire: Math.max(0, Math.ceil((w.expiresAt - now) / 1000)),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil((w.blockedUntil - now) / 1000) : 0,
    };
  }

  onModuleDestroy() {
    clearInterval(this.sweep);
  }

  private evict(now = Date.now()) {
    for (const [id, w] of this.windows) {
      if (w.expiresAt <= now && w.blockedUntil <= now) this.windows.delete(id);
    }
  }
}
