import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BeatsModule } from './beats/beats.module.js';
import { CommonModule } from './common/common.module.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { AppThrottlerGuard } from './common/guards/throttler.guard.js';
import { FastThrottlerStorage } from './common/throttler-storage.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { DatasetsModule } from './datasets/datasets.module.js';
import { HealthModule } from './health/health.module.js';
import { ImportsModule } from './imports/imports.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { OutletsModule } from './outlets/outlets.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { RoutesModule } from './routes/routes.module.js';
import { SalesModule } from './sales/sales.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';
import { VisitsModule } from './visits/visits.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
      }),
    }),
    // Limite de pedidos por utilizador autenticado (ou por IP); login/registo têm limite mais apertado.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: Number(config.get('THROTTLE_PER_MINUTE') ?? 600) }],
        // Custo constante por pedido (o armazenamento por omissão degrada com tráfego intenso).
        storage: new FastThrottlerStorage(),
      }),
    }),
    CommonModule,
    DatabaseModule,
    StorageModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    ProjectsModule,
    OutletsModule,
    RoutesModule,
    BeatsModule,
    VisitsModule,
    SalesModule,
    DatasetsModule,
    ImportsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Ordem importa: autenticação -> rate-limit (por utilizador) -> papéis.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
