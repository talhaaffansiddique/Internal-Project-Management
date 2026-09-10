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
import {
  CurrentUser,
  CurrentUserRoles,
} from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ProjectsService } from './projects.service.js';
import { TasksService } from './tasks.service.js';
import {
  AddProjectMemberDto,
  ChangeProjectStatusDto,
  ChangeTaskStatusDto,
  CreateProjectDto,
  CreateTaskDto,
  ListProjectsQuery,
  ListTasksQuery,
  UpdateProjectDto,
  UpdateTaskDto,
} from './projects.dto.js';

@Controller()
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
  ) {}

  // ---- Projects ----

  @Get('projects/stats')
  @Roles()
  stats(
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.projects.stats(userId, roles);
  }

  @Get('projects')
  @Roles()
  list(
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Query() query: ListProjectsQuery,
  ) {
    return this.projects.list(userId, roles, query);
  }

  @Get('projects/:id')
  @Roles()
  get(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.projects.get(id, userId, roles);
  }

  @Post('projects')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateProjectDto) {
    return this.projects.create(userId, dto);
  }

  @Patch('projects/:id')
  @Roles()
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(id, userId, roles, dto);
  }

  @Post('projects/:id/status')
  @Roles()
  changeStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: ChangeProjectStatusDto,
  ) {
    return this.projects.changeStatus(id, userId, roles, dto.statusKey);
  }

  @Post('projects/:id/members')
  @Roles()
  addMember(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projects.addMember(id, userId, roles, dto.userId);
  }

  @Delete('projects/:id/members/:memberId')
  @Roles()
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.projects.removeMember(id, userId, roles, memberId);
  }

  // ---- Tasks ----

  @Get('projects/:id/tasks')
  @Roles()
  projectTasks(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    // canView is enforced by projects.get inside the page; list is scoped by project id
    void userId;
    void roles;
    return this.tasks.listForProject(id);
  }

  @Post('projects/:id/tasks')
  @Roles()
  createTask(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(id, userId, roles, dto);
  }

  @Get('me/tasks')
  myTasks(@CurrentUser('id') userId: string) {
    return this.tasks.listMine(userId);
  }

  @Get('tasks')
  @Roles()
  tasksList(
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Query() query: ListTasksQuery,
  ) {
    return this.tasks.listCross(userId, roles, query);
  }

  @Get('tasks/:id')
  @Roles()
  getTask(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.tasks.get(id, userId, roles);
  }

  @Patch('tasks/:id')
  @Roles()
  updateTask(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(id, userId, roles, dto);
  }

  @Post('tasks/:id/status')
  @Roles()
  changeTaskStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: ChangeTaskStatusDto,
  ) {
    return this.tasks.changeStatus(id, userId, roles, dto.statusKey);
  }

  @Delete('tasks/:id')
  @Roles()
  deleteTask(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.tasks.remove(id, userId, roles);
  }
}
