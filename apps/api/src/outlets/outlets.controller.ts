import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ALL_ROLES, MANAGEMENT_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import {
  CreateOutletDto,
  ListOutletsQueryDto,
  NearbyQueryDto,
  OverdueQueryDto,
  ReviewOutletDto,
  UpdateOutletDto,
} from './dto/outlet.dto.js';
import { OutletsService } from './outlets.service.js';

@ApiTags('Outlets (Clientes / Lojas)')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller()
export class OutletsController {
  constructor(private readonly outlets: OutletsService) {}

  @Post('projects/:projectId/outlets')
  @ApiOperation({
    summary: 'Criar loja',
    description:
      'Deteta duplicados por código, telefone e nome+GPS (responde 409 com candidatos). ' +
      'Lojas criadas por FIELD_REP ficam PENDING_APPROVAL.',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateOutletDto,
  ) {
    return this.outlets.create(user, projectId, dto);
  }

  @Get('projects/:projectId/outlets')
  @ApiOperation({ summary: 'Listar lojas (com pesquisa, filtros e paginação)' })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListOutletsQueryDto,
  ) {
    return this.outlets.list(user, projectId, query);
  }

  @Get('projects/:projectId/outlets/nearby')
  @ApiOperation({ summary: 'Lojas próximas de uma coordenada GPS' })
  nearby(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: NearbyQueryDto,
  ) {
    return this.outlets.nearby(user, projectId, query);
  }

  @Get('projects/:projectId/outlets/overdue')
  @ApiOperation({
    summary: 'Lojas com visita em atraso, ordenadas por prioridade',
    description: 'Para importar a lista de lojas use POST /imports/upload com kind=OUTLETS.',
  })
  overdue(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: OverdueQueryDto,
  ) {
    return this.outlets.overdue(user, projectId, query);
  }

  @Post('projects/:projectId/outlets/check-duplicates')
  @ApiOperation({ summary: 'Verificar possíveis duplicados antes de criar' })
  checkDuplicates(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateOutletDto,
  ) {
    return this.outlets.checkDuplicates(user, projectId, dto);
  }

  @Get('outlets/:id')
  @ApiOperation({ summary: 'Detalhe da loja com últimas visitas, encomendas e pagamentos' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.outlets.findOne(user, id);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Patch('outlets/:id')
  @ApiOperation({ summary: 'Atualizar loja' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOutletDto) {
    return this.outlets.update(user, id, dto);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Post('outlets/:id/review')
  @ApiOperation({ summary: 'Aprovar ou rejeitar loja pendente' })
  review(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewOutletDto) {
    return this.outlets.review(user, id, dto);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Delete('outlets/:id')
  @ApiOperation({ summary: 'Apagar loja' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.outlets.remove(user, id);
  }
}
