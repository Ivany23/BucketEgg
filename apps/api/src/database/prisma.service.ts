import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Acrescenta o tamanho do pool ao URL, se ainda não estiver definido.
 * Regra (documentação do Prisma e da Neon): nº de processos/instâncias × pool por processo tem de
 * caber no limite de ligações da base de dados. O padrão do Prisma (2 × núcleos + 1 por processo)
 * esgota-o depressa com vários processos (medido aqui: 4 processos × 25 = 100 = limite do servidor).
 */
export function withPoolSettings(url: string, poolSize: number, poolTimeoutSeconds: number): string {
  const u = new URL(url);
  if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', String(poolSize));
  if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', String(poolTimeoutSeconds));
  return u.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      datasourceUrl: withPoolSettings(
        config.get<string>('DATABASE_URL'),
        Number(config.get('DB_POOL_SIZE')),
        Number(config.get('DB_POOL_TIMEOUT')),
      ),
      // Os padrões do Prisma (2 s à espera de ligação, 5 s por transação) são curtos quando a base está
      // longe: cada consulta de uma transação interativa é uma ida e volta (ex.: ~250 ms Maputo → EUA).
      transactionOptions: {
        maxWait: Number(config.get('DB_TX_MAX_WAIT_MS')),
        timeout: Number(config.get('DB_TX_TIMEOUT_MS')),
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
