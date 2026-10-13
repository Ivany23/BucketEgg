import { Module } from '@nestjs/common';
import { OutletsController } from './outlets.controller.js';
import { OutletsService } from './outlets.service.js';

@Module({
  providers: [OutletsService],
  controllers: [OutletsController],
})
export class OutletsModule {}
