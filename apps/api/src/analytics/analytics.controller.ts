import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ALL_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { AnalyticsService } from './analytics.service.js';

export class PeriodQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'Por defeito: há 30 dias' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Por defeito: hoje' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

@ApiTags('Analytics (Dashboard)')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller('projects/:projectId/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs: plano vs real, strike rate, vendas, cobranças, cobertura, leaderboard' })
  dashboard(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() q: PeriodQueryDto,
  ) {
    return this.analytics.dashboard(user, projectId, q.from, q.to);
  }

  @Get('sales-trend')
  @ApiOperation({ summary: 'Encomendas e receita por dia' })
  salesTrend(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() q: PeriodQueryDto,
  ) {
    return this.analytics.salesTrend(user, projectId, q.from, q.to);
  }
}
