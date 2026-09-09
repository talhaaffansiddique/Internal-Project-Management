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
  DesignationsService,
  BranchesService,
} from './simple-masters.service.js';
import {
  AddTeamMemberDto,
  CreateBranchDto,
  CreateDepartmentDto,
  CreateDesignationDto,
  CreateTeamDto,
  UpdateBranchDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
  UpdateTeamDto,
} from './org.dto.js';

const WRITE = ['ADMIN', 'SUPER_ADMIN'] as const;
const SUPER = ['SUPER_ADMIN'] as const;

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
  @Roles(...WRITE)
  create(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @Patch(':id')
  @Roles(...WRITE)
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
  @Roles(...WRITE)
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto);
  }

  @Patch(':id')
  @Roles(...WRITE)
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teams.update(id, dto);
  }

  @Post(':id/members')
  @Roles(...WRITE)
  addMember(@Param('id') id: string, @Body() dto: AddTeamMemberDto) {
    return this.teams.addMember(id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @Roles(...WRITE)
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.teams.removeMember(id, userId);
  }
}

@Controller('designations')
export class DesignationsController {
  constructor(private readonly designations: DesignationsService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.designations.list(includeInactive === 'true');
  }

  @Post()
  @Roles(...SUPER)
  create(@Body() dto: CreateDesignationDto) {
    return this.designations.create(dto);
  }

  @Patch(':id')
  @Roles(...SUPER)
  update(@Param('id') id: string, @Body() dto: UpdateDesignationDto) {
    return this.designations.update(id, dto);
  }

  @Delete(':id')
  @Roles(...SUPER)
  remove(@Param('id') id: string) {
    return this.designations.remove(id);
  }
}

@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.branches.list(includeInactive === 'true');
  }

  @Post()
  @Roles(...SUPER)
  create(@Body() dto: CreateBranchDto) {
    return this.branches.create(dto);
  }

  @Patch(':id')
  @Roles(...SUPER)
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branches.update(id, dto);
  }

  @Delete(':id')
  @Roles(...SUPER)
  remove(@Param('id') id: string) {
    return this.branches.remove(id);
  }
}
