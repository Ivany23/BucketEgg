import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { VisitsController } from './visits.controller.js';
import { VisitsService } from './visits.service.js';

@Module({
  providers: [VisitsService, AttendanceService],
  controllers: [VisitsController],
})
export class VisitsModule {}
