import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

export class CheckInDto {
  @ApiProperty()
  @IsUUID()
  outletId: string;

  @ApiPropertyOptional({ description: 'Tarefa/paragem da rota que está a ser executada' })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiProperty({ example: -25.9692 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 32.5732 })
  @IsLongitude()
  lng: number;
}

export class CheckOutDto {
  @ApiPropertyOptional({ example: -25.9692 })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 32.5732 })
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: 'Loja fechada', description: 'Motivo quando a visita não gerou encomenda' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  noOrderReason?: string;

  @ApiPropertyOptional({ type: [String], description: 'URLs das fotos (geo-tagged) tiradas na visita' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ require_tld: false }, { each: true })
  photoUrls?: string[];
}

export class ListVisitsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  outletId?: string;
}

export class ClockDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({ example: -25.9692 })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 32.5732 })
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'URL da selfie de presença' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  selfieUrl?: string;
}

export class AttendanceQueryDto {
  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
