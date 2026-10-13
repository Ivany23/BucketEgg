import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ADMIN_ROLES, ALL_ROLES, MANAGEMENT_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import {
  CreateOrderDto,
  CreatePaymentDto,
  CreateProductDto,
  ListOrdersQueryDto,
  ListProductsQueryDto,
  UpdateOrderStatusDto,
  UpdateProductDto,
} from './dto/sales.dto.js';
import { OrdersService } from './orders.service.js';
import { ProductsService } from './products.service.js';

@ApiTags('Products (Catálogo)')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Roles(...ADMIN_ROLES)
  @Post()
  @ApiOperation({ summary: 'Criar produto (SKU único por organização)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.products.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar catálogo' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListProductsQueryDto) {
    return this.products.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do produto' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOne(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar produto' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  @ApiOperation({ summary: 'Apagar produto (desativa se tiver vendas)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(user, id);
  }
}

@ApiTags('Orders & Payments (Vendas)')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  @ApiOperation({
    summary: 'Registar encomenda',
    description:
      'Preços e IVA vêm do catálogo. Valida limite de crédito da loja. ' +
      'A resposta inclui `missingMustSell` com os produtos obrigatórios que faltaram.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  @Get('projects/:projectId/orders')
  @ApiOperation({ summary: 'Listar encomendas (FIELD_REP vê apenas as suas)' })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.orders.list(user, projectId, query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Detalhe da encomenda' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findOne(user, id);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Confirmar, entregar ou cancelar encomenda' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(user, id, dto);
  }

  @Get('outlets/:id/suggested-order')
  @ApiOperation({ summary: 'Sugestão de encomenda com base no histórico e na Must Sell List' })
  suggested(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.suggestedOrder(user, id);
  }

  @Post('outlets/:id/payments')
  @ApiOperation({ summary: 'Registar cobrança/pagamento da loja' })
  addPayment(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePaymentDto) {
    return this.orders.addPayment(user, id, dto);
  }

  @Get('outlets/:id/statement')
  @ApiOperation({ summary: 'Extrato de conta da loja' })
  statement(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.statement(user, id);
  }
}
