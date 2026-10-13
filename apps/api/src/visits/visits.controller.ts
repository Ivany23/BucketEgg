import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ALL_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceQueryDto, CheckInDto, CheckOutDto, ClockDto, ListVisitsQueryDto } from './dto/visit.dto.js';
import { VisitsService } from './visits.service.js';

@ApiTags('Visits & Attendance (Execução no terreno)')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller()
export class VisitsController {
  constructor(
    private readonly visits: VisitsService,
    private readonly attendance: AttendanceService,
  ) {}

  @Post('visits/check-in')
  @ApiOperation({
    summary: 'Check-in numa loja',
    description:
      'Calcula a distância à loja e marca `withinGeofence` conforme o raio da organização. ' +
      'Lojas sem GPS ficam geo-referenciadas no primeiro check-in.',
  })
  checkIn(@CurrentUser() user: AuthUser, @Body() dto: CheckInDto) {
    return this.visits.checkIn(user, dto);
  }

  @Post('visits/:id/check-out')
  @ApiOperation({
    summary: 'Check-out da visita',
    description: 'Visitas sem encomenda exigem `noOrderReason`. Completa a tarefa e atualiza a última visita da loja.',
  })
  checkOut(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CheckOutDto) {
    return this.visits.checkOut(user, id, dto);
  }

  @Get('visits/active')
  @ApiOperation({ summary: 'Visita em curso do utilizador (ou null)' })
  active(@CurrentUser() user: AuthUser) {
    return this.visits.active(user);
  }

  @Get('projects/:projectId/visits')
  @ApiOperation({ summary: 'Histórico de visitas (por defeito últimos 30 dias)' })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListVisitsQueryDto,
  ) {
    return this.visits.list(user, projectId, query);
  }

  @Post('attendance/clock-in')
  @ApiOperation({ summary: 'Registar entrada (início do dia de trabalho)' })
  clockIn(@CurrentUser() user: AuthUser, @Body() dto: ClockDto) {
    return this.attendance.clockIn(user, dto);
  }

  @Post('attendance/clock-out')
  @ApiOperation({ summary: 'Registar saída (fim do dia de trabalho)' })
  clockOut(@CurrentUser() user: AuthUser, @Body() dto: ClockDto) {
    return this.attendance.clockOut(user, dto);
  }

  @Get('projects/:projectId/attendance')
  @ApiOperation({ summary: 'Presenças do dia (gestores veem também as faltas)' })
  day(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendance.day(user, projectId, query.date);
  }
}
