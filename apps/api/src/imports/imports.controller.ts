import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { DATA_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { CreateImportFromStorageDto, ListImportsQueryDto, PresignImportDto } from './dto/import.dto.js';
import { ImportsService } from './imports.service.js';

/**
 * Importação de ficheiros grandes (centenas de MB, milhões de linhas) em segundo plano.
 *
 * Duas formas de enviar o ficheiro:
 * 1. `POST /imports/upload` (multipart) — o ficheiro passa pela API em streaming.
 * 2. Upload direto (recomendado em produção com S3/R2): `POST /imports/presign` → o browser faz
 *    PUT do ficheiro para o `uploadUrl` → `POST /imports` com a `key`. O ficheiro nunca passa pela API.
 *
 * Em ambos os casos a resposta é imediata (202) com o job; consulte `GET /imports/:id` para o progresso.
 */
@ApiTags('Imports (Importações em massa)')
@ApiBearerAuth()
@Roles(...DATA_ROLES)
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'projectId'],
      properties: {
        projectId: { type: 'string', format: 'uuid' },
        kind: { type: 'string', enum: ['DATASET', 'OUTLETS'], default: 'DATASET' },
        name: { type: 'string', description: 'Nome do dataset (por defeito o nome do ficheiro)' },
        sheetName: { type: 'string', description: 'Folha a importar (por defeito a primeira)' },
        file: { type: 'string', format: 'binary', description: '.xlsx, .xls, .xlsb, .ods ou .csv' },
      },
    },
  })
  @ApiOperation({
    summary: 'Enviar ficheiro e pôr em fila de importação',
    description: 'DATASET: linhas para um dataset novo. OUTLETS: lista mestre de lojas (só gestores).',
  })
  upload(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.imports.uploadAndQueue(user, req);
  }

  @Post('presign')
  @ApiOperation({ summary: 'Obter URL de upload direto para S3/R2 (passo 1)' })
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignImportDto) {
    return this.imports.presign(user, dto);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Criar importação de um ficheiro já enviado por upload direto (passo 2)' })
  createFromStorage(@CurrentUser() user: AuthUser, @Body() dto: CreateImportFromStorageDto) {
    return this.imports.createFromStorage(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar importações da organização' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListImportsQueryDto) {
    return this.imports.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Estado e progresso de uma importação' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.findOne(user, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar importação (em fila ou em curso)' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.cancel(user, id);
  }
}
