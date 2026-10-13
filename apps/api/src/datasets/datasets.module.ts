import { Module } from '@nestjs/common';
import { DatasetsController } from './datasets.controller.js';
import { DatasetsService } from './datasets.service.js';

@Module({
  providers: [DatasetsService],
  controllers: [DatasetsController],
})
export class DatasetsModule {}
