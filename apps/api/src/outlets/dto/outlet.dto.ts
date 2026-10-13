import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { OutletStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

export class CreateOutletDto {
  @ApiProperty({ example: 'Mercearia Central' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 'CLI-0001', description: 'Código externo (ERP)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @ApiPropertyOptional({ example: 'Av. 24 de Julho, 123, Maputo' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: '+258840000000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'Sr. Mussa' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({ example: 'GT', description: 'Canal: GT, MT, HoReCa, B2B...' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  channel?: string;

  @ApiPropertyOptional({ example: 'A', description: 'Classe/segmento do cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  outletClass?: string;

  @ApiPropertyOptional({ example: 7, description: 'Frequência alvo de visita (dias)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  visitFrequencyDays?: number;

  @ApiPropertyOptional({ example: -25.9692 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 32.5732 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: 75, description: 'Potencial do cliente (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  potentialScore?: number;

  @ApiPropertyOptional({ example: 'Baixa' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  zone?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ description: 'Ignorar o aviso de possível duplicado e criar mesmo assim' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class UpdateOutletDto extends PartialType(OmitType(CreateOutletDto, ['force'] as const)) {
  @ApiPropertyOptional({ enum: OutletStatus })
  @IsOptional()
  @IsEnum(OutletStatus)
  status?: OutletStatus;
}

export class ListOutletsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Pesquisa por nome, código, morada ou telefone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outletClass?: string;

  @ApiPropertyOptional({ enum: OutletStatus })
  @IsOptional()
  @IsEnum(OutletStatus)
  status?: OutletStatus;
}

export class NearbyQueryDto {
  @ApiProperty({ example: -25.9692 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 32.5732 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ example: 1000, default: 1000, description: 'Raio em metros' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(50_000)
  radiusM: number = 1000;
}

export class ReviewOutletDto {
  @ApiProperty({ enum: [OutletStatus.ACTIVE, OutletStatus.REJECTED] })
  @IsEnum(OutletStatus)
  status: OutletStatus;
}

export class OverdueQueryDto {
  @ApiPropertyOptional({ default: 200, minimum: 1, maximum: 2000, description: 'Máximo de lojas devolvidas' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit: number = 200;
}
