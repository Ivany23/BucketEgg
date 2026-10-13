import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'ana@empresa.co.mz' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email inválido.' })
  email: string;

  @ApiProperty({ example: 'SenhaForte123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A palavra-passe deve ter pelo menos 8 caracteres.' })
  @MaxLength(72) // limite do bcrypt
  password: string;

  @ApiPropertyOptional({ example: 'Ana Machava' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'Distribuidora Maputo',
    description: 'Se indicado, cria logo a organização com o utilizador como OWNER.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  organizationName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@empresa.co.mz' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email inválido.' })
  email: string;

  @ApiProperty({ example: 'SenhaForte123' })
  @IsString()
  @MinLength(1)
  password: string;

  @ApiPropertyOptional({ description: 'Organização a abrir (por defeito, a primeira).' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class SwitchOrganizationDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A nova palavra-passe deve ter pelo menos 8 caracteres.' })
  @MaxLength(72)
  newPassword: string;
}
