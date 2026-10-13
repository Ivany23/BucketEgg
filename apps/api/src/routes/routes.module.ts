import { Module } from '@nestjs/common';
import { RouteOptimizerService } from './route-optimizer.service.js';
import { RoutesController } from './routes.controller.js';
import { RoutesService } from './routes.service.js';

@Module({
  providers: [RoutesService, RouteOptimizerService],
  controllers: [RoutesController],
  exports: [RoutesService],
})
export class RoutesModule {}
