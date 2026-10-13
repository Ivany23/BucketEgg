import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsTimeZone, Length, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Distribuidora Maputo' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'MZN', description: 'Código ISO 4217' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Africa/Maputo', description: 'Fuso horário IANA (hora local das rotas e do "meu dia")' })
  @IsOptional()
  @IsTimeZone({ message: 'timezone deve ser um fuso horário IANA válido (ex.: Africa/Maputo).' })
  timezone?: string;

  @ApiPropertyOptional({ example: 150, description: 'Raio em metros para validar check-ins por GPS' })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(5000)
  geofenceRadiusM?: number;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
