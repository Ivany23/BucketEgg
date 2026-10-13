import { Module } from '@nestjs/common';
import { RoutesModule } from '../routes/routes.module.js';
import { BeatsController } from './beats.controller.js';
import { BeatsService } from './beats.service.js';

@Module({
  imports: [RoutesModule],
  providers: [BeatsService],
  controllers: [BeatsController],
})
export class BeatsModule {}
