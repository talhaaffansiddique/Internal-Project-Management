import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { DepartmentsService } from './departments.service.js';
import { TeamsService } from './teams.service.js';
import {
  AddTeamMemberDto,
  CreateDepartmentDto,
  CreateTeamDto,
  UpdateDepartmentDto,
  UpdateTeamDto,
} from './org.dto.js';

const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

@Controller('roles')
export class RolesReadController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.role.findMany({
      orderBy: { rank: 'asc' },
      select: { id: true, key: true, name: true, description: true, rank: true },
    });
  }
}

@Controller('designations')
export class DesignationsReadController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.designation.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }
}

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.departments.list(includeInactive === 'true');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.departments.get(id);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  create(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(id, dto);
  }
}

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.teams.list(includeInactive === 'true');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.teams.get(id);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teams.update(id, dto);
  }

  @Post(':id/members')
  @Roles(...WRITE_ROLES)
  addMember(@Param('id') id: string, @Body() dto: AddTeamMemberDto) {
    return this.teams.addMember(id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @Roles(...WRITE_ROLES)
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.teams.removeMember(id, userId);
  }
}
