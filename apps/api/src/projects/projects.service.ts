import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../shared/audit.service.js';
import { NotificationsService } from '../shared/notifications.service.js';
import {
  CreateProjectDto,
  ListProjectsQuery,
  UpdateProjectDto,
} from './projects.dto.js';

const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'];
const projectNo = (n: number) => `PRJ-${String(n).padStart(4, '0')}`;

const DETAIL_INCLUDE = {
  owner: { select: { id: true, fullName: true, email: true } },
  members: {
    include: { user: { select: { id: true, fullName: true, email: true } } },
  },
} satisfies Prisma.ProjectInclude;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private isPrivileged(roles: string[]) {
    return roles.some((r) => PRIVILEGED.includes(r));
  }

  private async visibilityWhere(
    userId: string,
    roles: string[],
  ): Promise<Prisma.ProjectWhereInput> {
    if (this.isPrivileged(roles)) return {};
    return {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };
  }

  async canView(projectId: string, userId: string, roles: string[]) {
    if (this.isPrivileged(roles)) return true;
    const p = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, members: { where: { userId }, select: { id: true } } },
    });
    return !!p && (p.ownerId === userId || p.members.length > 0);
  }

  private async withProgress(projectId: string) {
    const grouped = await this.prisma.task.groupBy({
      by: ['statusKey'],
      where: { projectId },
      _count: { _all: true },
    });
    const total = grouped.reduce((s, g) => s + g._count._all, 0);
    const done = grouped.find((g) => g.statusKey === 'done')?._count._all ?? 0;
    return {
      taskCounts: grouped.reduce<Record<string, number>>((acc, g) => {
        acc[g.statusKey] = g._count._all;
        return acc;
      }, {}),
      progress: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }

  async list(userId: string, roles: string[], query: ListProjectsQuery) {
    const where: Prisma.ProjectWhereInput = {
      AND: [await this.visibilityWhere(userId, roles)],
    };
    const and = where.AND as Prisma.ProjectWhereInput[];
    if (query.view === 'mine') and.push({ ownerId: userId });
    if (query.statusKey) and.push({ statusKey: query.statusKey });
    if (query.type) and.push({ type: query.type });
    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    const projects = await this.prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: DETAIL_INCLUDE,
    });
    return Promise.all(
      projects.map(async (p) => ({ ...p, ...(await this.withProgress(p.id)) })),
    );
  }

  async get(id: string, userId: string, roles: string[]) {
    if (!(await this.canView(id, userId, roles))) {
      throw new ForbiddenException('You are not authorized to view this project');
    }
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!project) throw new NotFoundException('Project not found');
    return { ...project, ...(await this.withProgress(id)) };
  }

  private async validateMasterKey(
    typeKey: string,
    key: string,
    label: string,
  ) {
    const row = await this.prisma.masterDataValue.findFirst({
      where: { key, type: { key: typeKey }, active: true },
      select: { id: true },
    });
    if (!row) throw new BadRequestException(`Unknown ${label}: ${key}`);
  }

  async create(userId: string, dto: CreateProjectDto) {
    await this.validateMasterKey('project_types', dto.type, 'project type');
    const ownerId = dto.ownerId ?? userId;
    const memberIds = [...new Set([...(dto.memberIds ?? []), ownerId])];

    const project = await this.prisma.project.create({
      data: {
        title: dto.title.trim(),
        type: dto.type,
        description: dto.description?.trim() || null,
        ownerId,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        members: { create: memberIds.map((uId) => ({ userId: uId })) },
      },
      include: DETAIL_INCLUDE,
    });

    await this.audit.record({
      entityType: EntityType.PROJECT,
      entityId: project.id,
      action: 'CREATED',
      summary: `created project ${projectNo(project.number)}`,
      actorId: userId,
    });
    return { ...project, ...(await this.withProgress(project.id)) };
  }

  private async assertMayManage(id: string, userId: string, roles: string[]) {
    const p = await this.prisma.project.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!p) throw new NotFoundException('Project not found');
    if (!this.isPrivileged(roles) && p.ownerId !== userId) {
      throw new ForbiddenException('Only the project owner or an admin can do this');
    }
  }

  async update(id: string, userId: string, roles: string[], dto: UpdateProjectDto) {
    await this.assertMayManage(id, userId, roles);
    if (dto.type) {
      await this.validateMasterKey('project_types', dto.type, 'project type');
    }
    const project = await this.prisma.project.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        type: dto.type,
        description: dto.description?.trim(),
        ownerId: dto.ownerId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROJECT,
      entityId: id,
      action: 'UPDATED',
      summary: 'edited project details',
      actorId: userId,
    });
    return { ...project, ...(await this.withProgress(id)) };
  }

  async changeStatus(
    id: string,
    userId: string,
    roles: string[],
    statusKey: string,
  ) {
    await this.assertMayManage(id, userId, roles);
    await this.validateMasterKey('project_statuses', statusKey, 'project status');
    const before = await this.prisma.project.findUnique({
      where: { id },
      select: { statusKey: true },
    });
    const project = await this.prisma.project.update({
      where: { id },
      data: { statusKey },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROJECT,
      entityId: id,
      action: 'STATUS_CHANGED',
      summary: `changed status: ${before?.statusKey} → ${statusKey}`,
      actorId: userId,
      oldValue: before?.statusKey,
      newValue: statusKey,
    });
    return { ...project, ...(await this.withProgress(id)) };
  }

  async addMember(id: string, userId: string, roles: string[], memberId: string) {
    await this.assertMayManage(id, userId, roles);
    const user = await this.prisma.user.findUnique({ where: { id: memberId } });
    if (!user) throw new NotFoundException('User not found');
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: memberId } },
    });
    if (!existing) {
      await this.prisma.projectMember.create({
        data: { projectId: id, userId: memberId },
      });
      await this.audit.record({
        entityType: EntityType.PROJECT,
        entityId: id,
        action: 'MEMBER_ADDED',
        summary: `added ${user.fullName} to the project`,
        actorId: userId,
      });
      if (memberId !== userId) {
        await this.notifications.notify({
          recipientId: memberId,
          type: 'GENERAL',
          title: 'You were added to a project',
          entityType: EntityType.PROJECT,
          entityId: id,
        });
      }
    }
    return this.get(id, userId, roles);
  }

  async removeMember(
    id: string,
    userId: string,
    roles: string[],
    memberId: string,
  ) {
    await this.assertMayManage(id, userId, roles);
    await this.prisma.projectMember.deleteMany({
      where: { projectId: id, userId: memberId },
    });
    return this.get(id, userId, roles);
  }

  async stats(userId: string, roles: string[]) {
    const where = await this.visibilityWhere(userId, roles);
    const grouped = await this.prisma.project.groupBy({
      by: ['statusKey'],
      where,
      _count: { _all: true },
    });
    return grouped.reduce<Record<string, number>>((acc, g) => {
      acc[g.statusKey] = g._count._all;
      return acc;
    }, {});
  }
}
