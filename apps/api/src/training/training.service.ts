import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  EntityType,
  NotificationType,
  Prisma,
  TrainingAck,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../shared/audit.service.js';
import { NotificationsService } from '../shared/notifications.service.js';
import {
  CreateTrainingDto,
  ListTrainingQuery,
  UpdateTrainingDto,
} from './training.dto.js';

const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'];
const trainingNo = (n: number) => `TRN-${String(n).padStart(4, '0')}`;

/** brief §13.1 flow, plus one step back for corrections. */
const TRANSITIONS: Record<string, string[]> = {
  requested: ['scheduled'],
  scheduled: ['in_progress', 'requested'],
  in_progress: ['trainer_checklist', 'scheduled'],
  trainer_checklist: ['waiting_ack', 'in_progress'],
  waiting_ack: ['completed', 'trainer_checklist'],
  completed: ['waiting_ack'],
};

const DETAIL_INCLUDE = {
  trainer: { select: { id: true, fullName: true, email: true } },
  createdBy: { select: { id: true, fullName: true } },
  participants: {
    orderBy: { user: { fullName: 'asc' } },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  },
  checklist: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.TrainingInclude;

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private isPrivileged(roles: string[]) {
    return roles.some((r) => PRIVILEGED.includes(r));
  }

  private async load(id: string) {
    const t = await this.prisma.training.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!t) throw new NotFoundException('Training not found');
    return t;
  }

  private canView(
    t: {
      trainerId: string;
      createdById: string;
      participants: { userId: string }[];
    },
    userId: string,
    roles: string[],
  ) {
    return (
      this.isPrivileged(roles) ||
      t.trainerId === userId ||
      t.createdById === userId ||
      t.participants.some((p) => p.userId === userId)
    );
  }

  private assertManager(
    t: { trainerId: string; createdById: string },
    userId: string,
    roles: string[],
  ) {
    if (
      !this.isPrivileged(roles) &&
      t.trainerId !== userId &&
      t.createdById !== userId
    ) {
      throw new ForbiddenException(
        'Only the trainer, the requester or an admin can do this',
      );
    }
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

  private async notifyPeople(
    ids: string[],
    input: {
      type: NotificationType;
      title: string;
      body?: string;
      trainingId: string;
    },
    exclude?: string,
  ) {
    await this.notifications.notifyMany(
      ids.filter((i) => i !== exclude),
      {
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: EntityType.TRAINING,
        entityId: input.trainingId,
      },
    );
  }

  async list(userId: string, roles: string[], query: ListTrainingQuery) {
    const where: Prisma.TrainingWhereInput = {};
    if (!this.isPrivileged(roles)) {
      where.OR = [
        { trainerId: userId },
        { createdById: userId },
        { participants: { some: { userId } } },
      ];
    }
    if (query.view === 'mine') {
      where.OR = [
        { trainerId: userId },
        { participants: { some: { userId } } },
      ];
    }
    if (query.statusKey) where.statusKey = query.statusKey;
    if (query.categoryKey) where.categoryKey = query.categoryKey;
    if (query.q) {
      where.topic = { contains: query.q, mode: 'insensitive' };
    }
    return this.prisma.training.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: DETAIL_INCLUDE,
    });
  }

  async get(id: string, userId: string, roles: string[]) {
    const t = await this.load(id);
    if (!this.canView(t, userId, roles)) {
      throw new ForbiddenException('You are not on this training');
    }
    return t;
  }

  async create(userId: string, dto: CreateTrainingDto) {
    if (dto.categoryKey) {
      await this.validateMasterKey(
        'training_categories',
        dto.categoryKey,
        'training category',
      );
    }
    const trainer = await this.prisma.user.findUnique({
      where: { id: dto.trainerId },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');

    const participantIds = [...new Set(dto.participantIds)].filter(
      (p) => p !== dto.trainerId,
    );

    const training = await this.prisma.training.create({
      data: {
        topic: dto.topic.trim(),
        description: dto.description?.trim() || null,
        categoryKey: dto.categoryKey ?? null,
        type: dto.type,
        trainerId: dto.trainerId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        createdById: userId,
        participants: {
          create: participantIds.map((uId) => ({ userId: uId })),
        },
        checklist: {
          create: (dto.checklist ?? [])
            .map((l) => l.trim())
            .filter(Boolean)
            .map((label, i) => ({ label, sortOrder: i })),
        },
      },
      include: DETAIL_INCLUDE,
    });

    await this.audit.record({
      entityType: EntityType.TRAINING,
      entityId: training.id,
      action: 'CREATED',
      summary: `requested training ${trainingNo(training.number)}`,
      actorId: userId,
    });
    if (dto.trainerId !== userId) {
      await this.notifications.notify({
        recipientId: dto.trainerId,
        type: NotificationType.GENERAL,
        title: `You are the trainer for "${training.topic}"`,
        entityType: EntityType.TRAINING,
        entityId: training.id,
      });
    }
    await this.notifyPeople(
      participantIds,
      {
        type: NotificationType.GENERAL,
        title: `You have been added to training: ${training.topic}`,
        trainingId: training.id,
      },
      userId,
    );
    return training;
  }

  async update(
    id: string,
    userId: string,
    roles: string[],
    dto: UpdateTrainingDto,
  ) {
    const t = await this.load(id);
    this.assertManager(t, userId, roles);
    if (dto.categoryKey) {
      await this.validateMasterKey(
        'training_categories',
        dto.categoryKey,
        'training category',
      );
    }

    let participantOps:
      | Prisma.TrainingUpdateInput['participants']
      | undefined;
    if (dto.participantIds) {
      const trainerId = dto.trainerId ?? t.trainerId;
      const wanted = [...new Set(dto.participantIds)].filter(
        (p) => p !== trainerId,
      );
      const current = t.participants.map((p) => p.userId);
      const toAdd = wanted.filter((w) => !current.includes(w));
      const toRemove = current.filter((c) => !wanted.includes(c));
      participantOps = {
        deleteMany: toRemove.length ? { userId: { in: toRemove } } : undefined,
        create: toAdd.map((uId) => ({ userId: uId })),
      };
      await this.notifyPeople(
        toAdd,
        {
          type: NotificationType.GENERAL,
          title: `You have been added to training: ${t.topic}`,
          trainingId: id,
        },
        userId,
      );
    }

    const updated = await this.prisma.training.update({
      where: { id },
      data: {
        topic: dto.topic?.trim(),
        description: dto.description?.trim(),
        categoryKey: dto.categoryKey,
        type: dto.type,
        trainerId: dto.trainerId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        participants: participantOps,
      },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.TRAINING,
      entityId: id,
      action: 'UPDATED',
      summary: 'updated training details',
      actorId: userId,
    });
    return updated;
  }

  async changeStatus(
    id: string,
    userId: string,
    roles: string[],
    statusKey: string,
  ) {
    const t = await this.load(id);
    this.assertManager(t, userId, roles);
    const allowed = TRANSITIONS[t.statusKey] ?? [];
    if (!allowed.includes(statusKey)) {
      throw new BadRequestException(
        `Cannot move from "${t.statusKey}" to "${statusKey}"`,
      );
    }
    await this.validateMasterKey('training_statuses', statusKey, 'status');

    if (statusKey === 'completed') {
      const pending = t.participants.filter(
        (p) => p.ackStatus !== TrainingAck.CONFIRMED,
      );
      if (t.participants.length > 0 && pending.length > 0) {
        throw new BadRequestException(
          `Cannot complete — ${pending.length} participant(s) have not confirmed`,
        );
      }
    }

    const updated = await this.prisma.training.update({
      where: { id },
      data: {
        statusKey,
        completedAt: statusKey === 'completed' ? new Date() : t.completedAt,
      },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.TRAINING,
      entityId: id,
      action: 'STATUS_CHANGED',
      summary: `changed status: ${t.statusKey} → ${statusKey}`,
      actorId: userId,
      oldValue: t.statusKey,
      newValue: statusKey,
    });

    if (statusKey === 'waiting_ack') {
      await this.notifyPeople(
        t.participants.map((p) => p.userId),
        {
          type: NotificationType.TRAINING_ACK,
          title: `Please confirm you completed "${t.topic}"`,
          trainingId: id,
        },
        userId,
      );
    }
    return updated;
  }

  async addChecklistItem(
    id: string,
    userId: string,
    roles: string[],
    label: string,
  ) {
    const t = await this.load(id);
    this.assertManager(t, userId, roles);
    const max = await this.prisma.trainingChecklistItem.aggregate({
      where: { trainingId: id },
      _max: { sortOrder: true },
    });
    await this.prisma.trainingChecklistItem.create({
      data: {
        trainingId: id,
        label: label.trim(),
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    return this.load(id);
  }

  async toggleChecklistItem(
    id: string,
    itemId: string,
    userId: string,
    roles: string[],
    done: boolean,
  ) {
    const t = await this.load(id);
    this.assertManager(t, userId, roles);
    const item = t.checklist.find((c) => c.id === itemId);
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.prisma.trainingChecklistItem.update({
      where: { id: itemId },
      data: { done, doneAt: done ? new Date() : null },
    });
    return this.load(id);
  }

  async removeChecklistItem(
    id: string,
    itemId: string,
    userId: string,
    roles: string[],
  ) {
    const t = await this.load(id);
    this.assertManager(t, userId, roles);
    await this.prisma.trainingChecklistItem.deleteMany({
      where: { id: itemId, trainingId: id },
    });
    return this.load(id);
  }

  async addParticipant(
    id: string,
    userId: string,
    roles: string[],
    participantId: string,
  ) {
    const t = await this.load(id);
    this.assertManager(t, userId, roles);
    const user = await this.prisma.user.findUnique({
      where: { id: participantId },
    });
    if (!user) throw new NotFoundException('User not found');
    const exists = await this.prisma.trainingParticipant.findUnique({
      where: { trainingId_userId: { trainingId: id, userId: participantId } },
    });
    if (!exists) {
      await this.prisma.trainingParticipant.create({
        data: { trainingId: id, userId: participantId },
      });
      if (participantId !== userId) {
        await this.notifications.notify({
          recipientId: participantId,
          type: NotificationType.GENERAL,
          title: `You have been added to training: ${t.topic}`,
          entityType: EntityType.TRAINING,
          entityId: id,
        });
      }
    }
    return this.load(id);
  }

  async removeParticipant(
    id: string,
    userId: string,
    roles: string[],
    participantId: string,
  ) {
    const t = await this.load(id);
    this.assertManager(t, userId, roles);
    await this.prisma.trainingParticipant.deleteMany({
      where: { trainingId: id, userId: participantId },
    });
    return this.load(id);
  }

  async acknowledge(
    id: string,
    userId: string,
    roles: string[],
    result: 'CONFIRMED' | 'NEEDS_FOLLOW_UP',
    comment?: string,
  ) {
    const t = await this.get(id, userId, roles);
    const participant = t.participants.find((p) => p.userId === userId);
    if (!participant) {
      throw new BadRequestException('You are not a participant of this training');
    }
    if (t.statusKey !== 'waiting_ack') {
      throw new BadRequestException(
        'Acknowledgement is only open once the training is waiting for it',
      );
    }
    await this.prisma.trainingParticipant.update({
      where: { id: participant.id },
      data: {
        ackStatus: result as TrainingAck,
        ackAt: new Date(),
        ackComment: comment?.trim() || null,
      },
    });
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    await this.audit.record({
      entityType: EntityType.TRAINING,
      entityId: id,
      action: 'ACKNOWLEDGED',
      summary:
        result === 'CONFIRMED'
          ? `${actor?.fullName ?? 'A participant'} confirmed training completed`
          : `${actor?.fullName ?? 'A participant'} reported: needs follow-up`,
      actorId: userId,
      meta: comment ? { comment } : undefined,
    });
    for (const recipient of [t.trainerId, t.createdById]) {
      if (recipient !== userId) {
        await this.notifications.notify({
          recipientId: recipient,
          type: NotificationType.TRAINING_ACK,
          title: `${actor?.fullName ?? 'Someone'} ${
            result === 'CONFIRMED' ? 'confirmed' : 'needs follow-up on'
          } "${t.topic}"`,
          entityType: EntityType.TRAINING,
          entityId: id,
        });
      }
    }
    return this.load(id);
  }

  mine(userId: string) {
    return this.prisma.training.findMany({
      where: {
        OR: [
          { trainerId: userId },
          { participants: { some: { userId } } },
        ],
        statusKey: { not: 'completed' },
      },
      orderBy: { scheduledAt: 'asc' },
      include: DETAIL_INCLUDE,
    });
  }
}
