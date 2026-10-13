import { Global, Module } from '@nestjs/common';
import { PgService } from './pg.service.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, PgService],
  exports: [PrismaService, PgService],
})
export class DatabaseModule {}
