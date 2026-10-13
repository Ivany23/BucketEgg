import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

export const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'photo', 'select'] as const;

export class FieldDefinitionDto {
  @ApiProperty({ example: 'Preço na prateleira' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label: string;

  @ApiPropertyOptional({ enum: FIELD_TYPES, default: 'string' })
  @IsOptional()
  @IsIn(FIELD_TYPES)
  type?: (typeof FIELD_TYPES)[number];

  @ApiPropertyOptional({ default: true, description: 'false oculta a coluna/pergunta sem apagar os dados' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateFormDto {
  @ApiProperty({ example: 'Auditoria de prateleira' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiProperty({ type: [FieldDefinitionDto] })
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionDto)
  fields: FieldDefinitionDto[];
}

export class UpdateSchemaDto {
  @ApiProperty({
    description: 'Mapa chave -> definição. Chaves existentes são atualizadas; novas chaves acrescentam perguntas.',
    example: { col_0: { label: 'Nome da loja' }, col_9: { label: 'Nova pergunta', type: 'number' } },
  })
  @IsObject()
  fields: Record<string, FieldDefinitionDto>;
}

export class ListRecordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor (nextCursor da página anterior). Recomendado para datasets grandes: custo constante.',
  })
  @IsOptional()
  @Matches(/^\d{1,19}$/)
  cursor?: string;

  @ApiPropertyOptional({ description: 'Incluir registos removidos (apenas supervisores/analistas)' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeDeleted?: boolean;
}

export class UpdateRecordDto {
  @ApiPropertyOptional({
    example: { col_1: 130 },
    description: 'Apenas os campos a corrigir; os restantes mantêm-se. Use null para limpar um campo.',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true, description: 'Corrigir a loja associada (null para remover)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  outletId?: string | null;

  @ApiPropertyOptional({ example: 'Preço mal digitado pelo auditor' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Valor de `updatedAt` que o editor tinha quando abriu o registo. Se outro supervisor/analista ' +
      'o tiver alterado entretanto, a API responde 409 em vez de sobrescrever.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  lastKnownUpdatedAt?: string | null;
}

export class RecordReasonQueryDto {
  @ApiPropertyOptional({ example: 'Registo duplicado' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SubmitRecordDto {
  @ApiProperty({ example: { col_0: 'Sim', col_1: 120 }, description: 'Respostas indexadas pelas chaves do schema' })
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @ApiPropertyOptional({ example: -25.9692 })
  @IsOptional()
  @IsLatitude()
  gpsLat?: number;

  @ApiPropertyOptional({ example: 32.5732 })
  @IsOptional()
  @IsLongitude()
  gpsLng?: number;
}

export class ExportQueryDto {
  @ApiPropertyOptional({ enum: ['xlsx', 'csv'], default: 'xlsx', description: 'CSV é muito mais rápido para milhões de linhas' })
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';

  @ApiPropertyOptional({ enum: ['comma', 'semicolon'], default: 'comma', description: 'Separador do CSV (o Excel em português usa ;)' })
  @IsOptional()
  @IsIn(['comma', 'semicolon'])
  delimiter?: 'comma' | 'semicolon';
}
