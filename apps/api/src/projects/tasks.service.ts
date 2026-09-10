import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EntityType, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../shared/audit.service.js';
import { NotificationsService } from '../shared/notifications.service.js';
import { ProjectsService } from './projects.service.js';
import {
  CreateTaskDto,
  ListTasksQuery,
  UpdateTaskDto,
} from './projects.dto.js';

const INCLUDE = {
  assignee: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  project: { select: { id: true, number: true, title: true } },
  subtasks: {
    orderBy: { createdAt: 'asc' },
    include: { assignee: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly projects: ProjectsService,
  ) {}

  private async validateStatus(key: string) {
    const row = await this.prisma.masterDataValue.findFirst({
      where: { key, type: { key: 'task_statuses' }, active: true },
      select: { id: true },
    });
    if (!row) throw new BadRequestException(`Unknown task status: ${key}`);
  }

  listForProject(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId, parentTaskId: null },
      orderBy: { createdAt: 'asc' },
      include: INCLUDE,
    });
  }

  async listCross(
    userId: string,
    roles: string[],
    query: ListTasksQuery,
  ) {
    const visibleProjects = await this.projects.list(userId, roles, {});
    const projectIds = visibleProjects.map((p) => p.id);

    const where: Prisma.TaskWhereInput = { projectId: { in: projectIds } };
    if (query.view === 'mine') where.assigneeId = userId;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.statusKey) where.statusKey = query.statusKey;
    if (query.projectId) where.projectId = query.projectId;

    return this.prisma.task.findMany({
      where,
      orderBy: [{ statusKey: 'asc' }, { dueDate: 'asc' }],
      include: INCLUDE,
    });
  }

  listMine(userId: string) {
    return this.prisma.task.findMany({
      where: { assigneeId: userId, statusKey: { not: 'done' } },
      orderBy: { dueDate: 'asc' },
      include: INCLUDE,
    });
  }

  async get(id: string, userId: string, roles: string[]) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!(await this.projects.canView(task.projectId, userId, roles))) {
      throw new ForbiddenException('You are not authorized to view this task');
    }
    return task;
  }

  async create(
    projectId: string,
    userId: string,
    roles: string[],
    dto: CreateTaskDto,
  ) {
    if (!(await this.projects.canView(projectId, userId, roles))) {
      throw new ForbiddenException('You are not a member of this project');
    }
    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findFirst({
        where: { id: dto.parentTaskId, projectId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('Parent task not found in this project');
    }
    if (dto.assigneeId) {
      const u = await this.prisma.user.findUnique({ where: { id: dto.assigneeId } });
      if (!u) throw new NotFoundException('Assignee not found');
    }

    const task = await this.prisma.task.create({
      data: {
        projectId,
        parentTaskId: dto.parentTaskId ?? null,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        assigneeId: dto.assigneeId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdById: userId,
      },
      include: INCLUDE,
    });

    await this.audit.record({
      entityType: EntityType.PROJECT,
      entityId: projectId,
      action: 'TASK_CREATED',
      summary: `added task "${task.title}"`,
      actorId: userId,
    });
    if (dto.assigneeId && dto.assigneeId !== userId) {
      await this.notifications.notify({
        recipientId: dto.assigneeId,
        type: NotificationType.ASSIGNMENT,
        title: `Task assigned to you: ${task.title}`,
        entityType: EntityType.PROJECT,
        entityId: projectId,
      });
    }
    return task;
  }

  async update(id: string, userId: string, roles: string[], dto: UpdateTaskDto) {
    const existing = await this.get(id, userId, roles);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: INCLUDE,
    });

    if (
      dto.assigneeId &&
      dto.assigneeId !== existing.assigneeId &&
      dto.assigneeId !== userId
    ) {
      await this.notifications.notify({
        recipientId: dto.assigneeId,
        type: NotificationType.ASSIGNMENT,
        title: `Task assigned to you: ${task.title}`,
        entityType: EntityType.PROJECT,
        entityId: task.projectId,
      });
      await this.audit.record({
        entityType: EntityType.PROJECT,
        entityId: task.projectId,
        action: 'TASK_ASSIGNMENT_CHANGED',
        summary: `reassigned task "${task.title}"`,
        actorId: userId,
      });
    }
    return task;
  }

  async changeStatus(
    id: string,
    userId: string,
    roles: string[],
    statusKey: string,
  ) {
    const existing = await this.get(id, userId, roles);
    await this.validateStatus(statusKey);
    const task = await this.prisma.task.update({
      where: { id },
      data: { statusKey },
      include: INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROJECT,
      entityId: task.projectId,
      action: 'TASK_STATUS_CHANGED',
      summary: `task "${task.title}": ${existing.statusKey} → ${statusKey}`,
      actorId: userId,
      oldValue: existing.statusKey,
      newValue: statusKey,
    });
    return task;
  }

  async remove(id: string, userId: string, roles: string[]) {
    const task = await this.get(id, userId, roles);
    const p = await this.prisma.project.findUnique({
      where: { id: task.projectId },
      select: { ownerId: true },
    });
    const privileged = roles.some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r));
    if (
      !privileged &&
      p?.ownerId !== userId &&
      task.createdById !== userId
    ) {
      throw new ForbiddenException(
        'Only the task creator, project owner or an admin can delete a task',
      );
    }
    await this.prisma.task.delete({ where: { id } });
    await this.audit.record({
      entityType: EntityType.PROJECT,
      entityId: task.projectId,
      action: 'TASK_DELETED',
      summary: `removed task "${task.title}"`,
      actorId: userId,
    });
    return { ok: true };
  }
}
