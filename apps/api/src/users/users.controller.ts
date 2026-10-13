import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ALL_ROLES, MANAGEMENT_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { AddMemberDto, UpdateMemberDto, UpdateProfileDto } from './dto/team.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users & Team')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('users/me')
  @ApiOperation({ summary: 'Atualizar o meu perfil' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user, dto);
  }

  @Roles(...ALL_ROLES)
  @Get('team')
  @ApiOperation({ summary: 'Listar membros da organização ativa' })
  list(@CurrentUser() user: AuthUser) {
    return this.usersService.listMembers(user);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Get('team/mine')
  @ApiOperation({ summary: 'Membros que eu supervisiono' })
  mine(@CurrentUser() user: AuthUser) {
    return this.usersService.myTeam(user);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Post('team')
  @ApiOperation({
    summary: 'Adicionar membro à equipa',
    description: 'Cria a conta se o email não existir; caso contrário, associa a conta existente à organização.',
  })
  add(@CurrentUser() user: AuthUser, @Body() dto: AddMemberDto) {
    return this.usersService.addMember(user, dto);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Patch('team/:membershipId')
  @ApiOperation({ summary: 'Alterar papel, supervisores ou estado de um membro' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.usersService.updateMember(user, membershipId, dto);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Delete('team/:membershipId')
  @ApiOperation({ summary: 'Desativar membro (o histórico é preservado)' })
  remove(@CurrentUser() user: AuthUser, @Param('membershipId', ParseUUIDPipe) membershipId: string) {
    return this.usersService.removeMember(user, membershipId);
  }
}
