import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthUser } from '../common/types.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto, LoginDto, RegisterDto, SwitchOrganizationDto } from './dto/auth.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Criar conta',
    description:
      'Cria o utilizador. Se `organizationName` for enviado, cria também a organização (OWNER). ' +
      'Caso contrário a resposta traz `needsOnboarding: true` e o cliente deve chamar `POST /organizations`.',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Autenticar e obter token JWT' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Perfil do utilizador e organizações a que pertence' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('switch-organization')
  @ApiOperation({ summary: 'Mudar a organização ativa (emite novo token)' })
  switchOrganization(@CurrentUser() user: AuthUser, @Body() dto: SwitchOrganizationDto) {
    return this.authService.switchOrganization(user, dto.organizationId);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  @ApiOperation({ summary: 'Alterar palavra-passe' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user, dto);
  }
}
