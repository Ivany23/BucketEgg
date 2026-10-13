import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LocationDto } from '../../common/dto/location.dto.js';

export class PlanRouteDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty({ description: 'ID do utilizador (promotor) que executa a rota' })
  @IsUUID()
  assigneeId: string;

  @ApiProperty({ example: 'Rota Baixa - 15/10' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '2026-10-15T08:00:00.000Z', description: 'Data/hora de início da rota' })
  @IsDateString()
  date: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  outletIds: string[];

  @ApiPropertyOptional({ type: LocationDto, description: 'Ponto de partida (ex.: armazém)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  startLocation?: LocationDto;

  @ApiPropertyOptional({ type: LocationDto, description: 'Destino final (por defeito regressa ao início)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  endLocation?: LocationDto;

  @ApiPropertyOptional({ default: 15, description: 'Minutos previstos em cada loja' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  serviceMinsPerStop?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  beatId?: string;
}

export class ListRoutesQueryDto {
  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

export class CreateTaskDto {
  @ApiProperty()
  @IsUUID()
  outletId: string;

  @ApiProperty()
  @IsUUID()
  assigneeId: string;

  @ApiProperty({ example: '2026-10-15' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ example: 'Recolher pagamento pendente' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class MyDayQueryDto {
  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
