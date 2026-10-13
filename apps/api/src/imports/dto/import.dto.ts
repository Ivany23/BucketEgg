import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImportKind, JobStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

/** Campos enviados no formulário multipart junto com o ficheiro. */
export class UploadImportFieldsDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({ enum: ImportKind, default: ImportKind.DATASET })
  @IsOptional()
  @IsEnum(ImportKind)
  kind: ImportKind = ImportKind.DATASET;

  @ApiPropertyOptional({ description: 'Nome do dataset a criar (por defeito o nome do ficheiro)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ description: 'Folha a importar (por defeito a primeira)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sheetName?: string;
}

export class PresignImportDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: 'vendas-2026-10-08.xlsx' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName: string;

  @ApiProperty({ example: 314572800, description: 'Tamanho do ficheiro em bytes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize: number;
}

export class CreateImportFromStorageDto extends UploadImportFieldsDto {
  @ApiProperty({ description: 'Chave devolvida por POST /imports/presign, depois de o ficheiro ser enviado' })
  @IsString()
  @Matches(/^imports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[^/]+$/)
  key: string;
}

export class ListImportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
