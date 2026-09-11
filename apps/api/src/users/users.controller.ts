import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUserRoles } from '../auth/current-user.decorator.js';
import {
  AssignRolesDto,
  CreateUserDto,
  ListUsersQuery,
  UpdateUserDto,
  UpdateUserStatusDto,
} from './users.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Lightweight picker for @mention / assignee fields — any authenticated user. Pass `role` to filter to users holding that role key. */
  @Get('lookup')
  lookup(@Query('q') q?: string, @Query('role') role?: string) {
    return this.users.lookup(q ?? '', role);
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(
    @CurrentUserRoles() actorRoles: string[],
    @Body() dto: CreateUserDto,
  ) {
    return this.users.create(actorRoles, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(
    @CurrentUserRoles() actorRoles: string[],
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(actorRoles, id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  setStatus(
    @CurrentUserRoles() actorRoles: string[],
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.setStatus(actorRoles, id, dto.status);
  }

  @Patch(':id/roles')
  @Roles('ADMIN', 'SUPER_ADMIN')
  setRoles(
    @CurrentUserRoles() actorRoles: string[],
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
  ) {
    return this.users.setRoles(actorRoles, id, dto.roleKeys);
  }
}
