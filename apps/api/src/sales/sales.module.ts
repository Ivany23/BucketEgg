import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { ProductsService } from './products.service.js';
import { OrdersController, ProductsController } from './sales.controller.js';

@Module({
  providers: [ProductsService, OrdersService],
  controllers: [ProductsController, OrdersController],
})
export class SalesModule {}
