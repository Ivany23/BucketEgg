import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ADMIN_ROLES, ALL_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { TokenService } from '../auth/token.service.js';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto.js';
import { OrganizationsService } from './organizations.service.js';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly tokens: TokenService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar organização',
    description: 'O utilizador torna-se OWNER. Devolve um novo token já com esta organização ativa.',
  })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) {
    const org = await this.organizationsService.create(user, dto);
    return { organization: org, session: await this.tokens.issue(user.sub, org.id) };
  }

  @Get()
  @ApiOperation({ summary: 'Listar as minhas organizações' })
  findMine(@CurrentUser() user: AuthUser) {
    return this.organizationsService.listMine(user);
  }

  @Roles(...ALL_ROLES)
  @Get('current')
  @ApiOperation({ summary: 'Detalhes da organização ativa' })
  current(@CurrentUser() user: AuthUser) {
    return this.organizationsService.current(user);
  }

  @Roles(...ADMIN_ROLES)
  @Patch('current')
  @ApiOperation({ summary: 'Atualizar definições da organização ativa' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(user, dto);
  }
}
