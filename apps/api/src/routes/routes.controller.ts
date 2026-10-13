import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ALL_ROLES, MANAGEMENT_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { CreateTaskDto, ListRoutesQueryDto, MyDayQueryDto, PlanRouteDto, UpdateTaskDto } from './dto/route.dto.js';
import { RoutesService } from './routes.service.js';

@ApiTags('Routes & Tasks (Planeamento)')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller()
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Roles(...MANAGEMENT_ROLES)
  @Post('routes/plan')
  @ApiOperation({
    summary: 'Planear e otimizar uma rota',
    description:
      'Com `startLocation` e GOOGLE_MAPS_API_KEY usa a Google Routes API (até 25 lojas). ' +
      'Caso contrário usa vizinho-mais-próximo + 2-opt. Gera uma tarefa por loja com hora prevista.',
  })
  plan(@CurrentUser() user: AuthUser, @Body() dto: PlanRouteDto) {
    return this.routesService.planAndOptimizeRoute(user, dto);
  }

  @Get('projects/:projectId/routes')
  @ApiOperation({ summary: 'Listar rotas (FIELD_REP vê apenas as suas)' })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListRoutesQueryDto,
  ) {
    return this.routesService.list(user, projectId, query);
  }

  @Get('routes/my-day')
  @ApiOperation({ summary: 'O meu plano do dia (tarefas ordenadas)' })
  myDay(@CurrentUser() user: AuthUser, @Query() query: MyDayQueryDto) {
    return this.routesService.myDay(user, query.date);
  }

  @Get('routes/:id')
  @ApiOperation({ summary: 'Detalhe da rota com paragens' })
  getRoute(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.getRouteDetails(user, id);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Delete('routes/:id')
  @ApiOperation({ summary: 'Apagar rota (remove paragens pendentes)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.deleteRoute(user, id);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Post('projects/:projectId/tasks')
  @ApiOperation({ summary: 'Criar tarefa/visita ad-hoc' })
  createTask(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.routesService.createTask(user, projectId, dto);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Atualizar estado/notas de uma tarefa' })
  updateTask(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.routesService.updateTask(user, id, dto);
  }
}
