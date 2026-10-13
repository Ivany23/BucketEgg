import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ALL_ROLES, MANAGEMENT_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { BeatsService } from './beats.service.js';
import { CreateBeatDto, GenerateRoutesDto, UpdateBeatDto } from './dto/beat.dto.js';

@ApiTags('Beats (Rotas fixas / Journey plan)')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller()
export class BeatsController {
  constructor(private readonly beats: BeatsService) {}

  @Roles(...MANAGEMENT_ROLES)
  @Post('projects/:projectId/beats')
  @ApiOperation({ summary: 'Criar beat (conjunto fixo de lojas visitado em dias da semana definidos)' })
  create(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateBeatDto) {
    return this.beats.create(user, projectId, dto);
  }

  @Get('projects/:projectId/beats')
  @ApiOperation({ summary: 'Listar beats' })
  list(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.beats.list(user, projectId);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Post('projects/:projectId/beats/generate-day')
  @ApiOperation({ summary: 'Gerar as rotas do dia para todos os beats agendados nesse dia da semana' })
  generateDay(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: GenerateRoutesDto,
  ) {
    return this.beats.generateDay(user, projectId, dto);
  }

  @Get('beats/:id')
  @ApiOperation({ summary: 'Detalhe do beat com lojas' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.beats.findOne(user, id);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Patch('beats/:id')
  @ApiOperation({ summary: 'Atualizar beat (enviar outletIds substitui a lista de lojas)' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBeatDto) {
    return this.beats.update(user, id, dto);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Delete('beats/:id')
  @ApiOperation({ summary: 'Apagar beat' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.beats.remove(user, id);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Post('beats/:id/generate-route')
  @ApiOperation({ summary: 'Gerar a rota otimizada deste beat para um dia' })
  generateRoute(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateRoutesDto,
  ) {
    return this.beats.generateRoute(user, id, dto);
  }
}
