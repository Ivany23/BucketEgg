import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LocationDto } from '../../common/dto/location.dto.js';

export class CreateBeatDto {
  @ApiProperty({ example: 'Beat Baixa - Segunda/Quinta' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: [1, 4], description: 'Dias da semana (0=Domingo ... 6=Sábado)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @ApiPropertyOptional({ description: 'Promotor responsável' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Lojas do beat (a ordem é preservada)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  outletIds?: string[];
}

export class UpdateBeatDto extends PartialType(CreateBeatDto) {}

export class GenerateRoutesDto {
  @ApiProperty({ example: '2026-10-15', description: 'Dia para o qual gerar as rotas' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: '08:00', description: 'Hora de início das rotas (HH:MM, hora local da organização)' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime deve estar no formato HH:MM (00:00 a 23:59).' })
  startTime?: string;

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  startLocation?: LocationDto;
}
