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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ADMIN_ROLES, ALL_ROLES, DATA_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { DatasetsService } from './datasets.service.js';
import {
  CreateFormDto,
  ExportQueryDto,
  ListRecordsQueryDto,
  RecordReasonQueryDto,
  SubmitRecordDto,
  UpdateRecordDto,
  UpdateSchemaDto,
} from './dto/dataset.dto.js';


/**
 * Permissões:
 * - FIELD_REP (auditor): vê os formulários, submete respostas e consulta apenas as suas. Não edita nem apaga.
 * - MANAGER (supervisor) e ANALYST: veem tudo, corrigem, removem/restauram e exportam (com histórico).
 * - OWNER/ADMIN: tudo, incluindo apagar definitivamente um dataset.
 */
@ApiTags('Datasets & Forms (Dados / Inquéritos)')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller()
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Roles(...DATA_ROLES)
  @Post('projects/:projectId/forms')
  @ApiOperation({ summary: 'Criar formulário (auditoria/inquérito) para preencher no terreno' })
  createForm(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateFormDto,
  ) {
    return this.datasetsService.createForm(user, projectId, dto);
  }

  @Get('datasets/project/:projectId')
  @ApiOperation({ summary: 'Listar datasets/formulários do projeto' })
  findAll(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.datasetsService.getDatasets(user, projectId);
  }

  @Get('datasets/:id/records')
  @ApiOperation({ summary: 'Registos do dataset (o auditor vê só os que recolheu)' })
  records(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: ListRecordsQueryDto) {
    return this.datasetsService.getDatasetRecords(user, id, query);
  }

  @Post('datasets/:id/records')
  @ApiOperation({
    summary: 'Submeter recolha de dados (auditor)',
    description: 'Depois de submetido, o registo só pode ser corrigido por supervisores ou analistas.',
  })
  submit(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitRecordDto) {
    return this.datasetsService.submitRecord(user, id, dto);
  }

  @Roles(...DATA_ROLES)
  @Patch('datasets/:id/records/:recordId')
  @ApiOperation({
    summary: 'Corrigir registo (supervisor/analista)',
    description:
      'Grava no histórico quem alterou, o valor anterior e o novo. Envie `lastKnownUpdatedAt` para evitar ' +
      'sobrescrever a correção de outro supervisor (responde 409).',
  })
  updateRecord(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: UpdateRecordDto,
  ) {
    return this.datasetsService.updateRecord(user, id, recordId, dto);
  }

  @Roles(...DATA_ROLES)
  @Delete('datasets/:id/records/:recordId')
  @ApiOperation({ summary: 'Remover registo (remoção lógica, pode ser restaurado)' })
  deleteRecord(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Query() query: RecordReasonQueryDto,
  ) {
    return this.datasetsService.deleteRecord(user, id, recordId, query.reason);
  }

  @Roles(...DATA_ROLES)
  @Post('datasets/:id/records/:recordId/restore')
  @ApiOperation({ summary: 'Restaurar registo removido' })
  restoreRecord(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Query() query: RecordReasonQueryDto,
  ) {
    return this.datasetsService.restoreRecord(user, id, recordId, query.reason);
  }

  @Roles(...DATA_ROLES)
  @Get('datasets/:id/records/:recordId/history')
  @ApiOperation({ summary: 'Histórico de alterações do registo (auditoria)' })
  history(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ) {
    return this.datasetsService.recordHistory(user, id, recordId);
  }

  @Roles(...DATA_ROLES)
  @Patch('datasets/:id/schema')
  @ApiOperation({ summary: 'Renomear, ocultar ou acrescentar colunas/perguntas' })
  updateSchema(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSchemaDto) {
    return this.datasetsService.updateSchema(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Delete('datasets/:id')
  @ApiOperation({ summary: 'Apagar dataset definitivamente (apenas OWNER/ADMIN)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.datasetsService.deleteDataset(user, id);
  }

  @Roles(...DATA_ROLES)
  @Get('datasets/:id/download')
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv')
  @ApiOperation({
    summary: 'Exportar dataset (XLSX ou CSV) em streaming',
    description: 'Sem registos removidos. Suporta milhões de linhas; o XLSX divide em folhas acima de 1 048 575 linhas.',
  })
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    await this.datasetsService.streamExport(user, id, query, res);
  }
}
