import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityStatus, EntityType, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';
import { NotificationsService } from './notifications.service.js';

const INCLUDE = {
  assignedTo: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
};

interface CreateActivityInput {
  title: string;
  assignedToId: string;
  dueAt: string;
  entityType?: EntityType;
  entityId?: string;
}

interface UpdateActivityInput {
  title?: string;
  assignedToId?: string;
  dueAt?: string;
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actorId: string, dto: CreateActivityInput) {
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
    });
    if (!assignee) throw new NotFoundException('Assignee not found');

    const activity = await this.prisma.activity.create({
      data: {
        title: dto.title.trim(),
        assignedToId: dto.assignedToId,
        dueAt: new Date(dto.dueAt),
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        createdById: actorId,
      },
      include: INCLUDE,
    });

    if (dto.assignedToId !== actorId) {
      await this.notifications.notify({
        recipientId: dto.assignedToId,
        type: NotificationType.ASSIGNMENT,
        title: `New activity: ${activity.title}`,
        body: `Due ${activity.dueAt.toLocaleString()}`,
        entityType: dto.entityType,
        entityId: dto.entityId,
      });
    }
    if (dto.entityType && dto.entityId) {
      await this.audit.record({
        entityType: dto.entityType,
        entityId: dto.entityId,
        action: 'ACTIVITY_CREATED',
        summary: `created activity "${activity.title}"`,
        actorId,
      });
    }
    return activity;
  }

  async update(id: string, actorId: string, dto: UpdateActivityInput) {
    const existing = await this.prisma.activity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Activity not found');

    const activity = await this.prisma.activity.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        assignedToId: dto.assignedToId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
      include: INCLUDE,
    });

    if (
      dto.assignedToId &&
      dto.assignedToId !== existing.assignedToId &&
      dto.assignedToId !== actorId
    ) {
      await this.notifications.notify({
        recipientId: dto.assignedToId,
        type: NotificationType.ASSIGNMENT,
        title: `Activity assigned to you: ${activity.title}`,
        entityType: activity.entityType ?? undefined,
        entityId: activity.entityId ?? undefined,
      });
    }
    return activity;
  }

  async complete(id: string, actorId: string) {
    const existing = await this.prisma.activity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Activity not found');

    const activity = await this.prisma.activity.update({
      where: { id },
      data: { status: ActivityStatus.DONE, completedAt: new Date() },
      include: INCLUDE,
    });

    if (existing.entityType && existing.entityId) {
      await this.audit.record({
        entityType: existing.entityType,
        entityId: existing.entityId,
        action: 'ACTIVITY_COMPLETED',
        summary: `completed activity "${activity.title}"`,
        actorId,
      });
    }
    return activity;
  }

  listMine(userId: string, includeDone: boolean) {
    return this.prisma.activity.findMany({
      where: {
        assignedToId: userId,
        ...(includeDone ? {} : { status: ActivityStatus.OPEN }),
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      include: INCLUDE,
    });
  }

  list(params: {
    assignedToId?: string;
    status?: ActivityStatus;
    entityType?: EntityType;
    entityId?: string;
  }) {
    return this.prisma.activity.findMany({
      where: {
        ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.entityType ? { entityType: params.entityType } : {}),
        ...(params.entityId ? { entityId: params.entityId } : {}),
      },
      orderBy: { dueAt: 'asc' },
      include: INCLUDE,
    });
  }
}
