import { Module } from '@nestjs/common';
import { ImportWorker } from './import.worker.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  providers: [ImportsService, ImportWorker],
  controllers: [ImportsController],
})
export class ImportsModule {}
