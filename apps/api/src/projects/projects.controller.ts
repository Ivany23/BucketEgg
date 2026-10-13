import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ADMIN_ROLES, ALL_ROLES, MANAGEMENT_ROLES, Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('Projects')
@ApiBearerAuth()
@Roles(...ALL_ROLES)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Roles(...MANAGEMENT_ROLES)
  @Post()
  @ApiOperation({ summary: 'Criar projeto/campanha na organização ativa' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user, dto);
  }

  @Get()
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiOperation({ summary: 'Listar projetos' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('includeArchived', new ParseBoolPipe({ optional: true })) includeArchived?: boolean,
  ) {
    return this.projectsService.findAll(user, includeArchived);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um projeto' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(user, id);
  }

  @Roles(...MANAGEMENT_ROLES)
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar ou arquivar projeto' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  @ApiOperation({ summary: 'Apagar projeto e todos os dados associados' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.remove(user, id);
  }
}
