import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  EntityType,
  MeetingResponse,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../shared/audit.service.js';
import { NotificationsService } from '../shared/notifications.service.js';
import { ActivitiesService } from '../shared/activities.service.js';
import {
  ActionItemDto,
  CreateMeetingDto,
  ListMeetingsQuery,
  UpdateMeetingDto,
} from './meetings.dto.js';

const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'];
const meetingNo = (n: number) => `MTG-${String(n).padStart(4, '0')}`;

const DETAIL_INCLUDE = {
  organizer: { select: { id: true, fullName: true, email: true } },
  project: { select: { id: true, number: true, title: true } },
  participants: {
    orderBy: { user: { fullName: 'asc' } },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  },
} satisfies Prisma.MeetingInclude;

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly activities: ActivitiesService,
  ) {}

  private isPrivileged(roles: string[]) {
    return roles.some((r) => PRIVILEGED.includes(r));
  }

  private async load(id: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  private canView(
    meeting: { organizerId: string; participants: { userId: string }[] },
    userId: string,
    roles: string[],
  ) {
    return (
      this.isPrivileged(roles) ||
      meeting.organizerId === userId ||
      meeting.participants.some((p) => p.userId === userId)
    );
  }

  private assertOrganizer(
    meeting: { organizerId: string },
    userId: string,
    roles: string[],
  ) {
    if (!this.isPrivileged(roles) && meeting.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can do this');
    }
  }

  async list(userId: string, roles: string[], query: ListMeetingsQuery) {
    const where: Prisma.MeetingWhereInput = {};
    if (!this.isPrivileged(roles)) {
      where.OR = [
        { organizerId: userId },
        { participants: { some: { userId } } },
      ];
    }
    if (query.from || query.to) {
      where.startsAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.projectId) where.projectId = query.projectId;

    return this.prisma.meeting.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: DETAIL_INCLUDE,
    });
  }

  async get(id: string, userId: string, roles: string[]) {
    const meeting = await this.load(id);
    if (!this.canView(meeting, userId, roles)) {
      throw new ForbiddenException('You are not on this meeting');
    }
    return meeting;
  }

  async create(userId: string, dto: CreateMeetingDto) {
    if (new Date(dto.endsAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException('End time must be after start time');
    }
    const participantIds = [...new Set(dto.participantIds)].filter(
      (p) => p !== userId,
    );
    const found = await this.prisma.user.findMany({
      where: { id: { in: participantIds } },
      select: { id: true },
    });
    if (found.length !== participantIds.length) {
      throw new BadRequestException('One or more participants do not exist');
    }

    const meeting = await this.prisma.meeting.create({
      data: {
        title: dto.title.trim(),
        agenda: dto.agenda?.trim() || null,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        organizerId: userId,
        location: dto.location?.trim() || null,
        onlineLink: dto.onlineLink?.trim() || null,
        projectId: dto.projectId ?? null,
        participants: {
          create: participantIds.map((uId) => ({ userId: uId })),
        },
      },
      include: DETAIL_INCLUDE,
    });

    await this.audit.record({
      entityType: EntityType.MEETING,
      entityId: meeting.id,
      action: 'CREATED',
      summary: `scheduled meeting ${meetingNo(meeting.number)}`,
      actorId: userId,
    });
    await this.notifications.notifyMany(participantIds, {
      type: NotificationType.MEETING_INVITATION,
      title: `Meeting invitation: ${meeting.title}`,
      body: `${new Date(meeting.startsAt).toLocaleString()}`,
      entityType: EntityType.MEETING,
      entityId: meeting.id,
    });
    return this.load(meeting.id);
  }

  async update(id: string, userId: string, roles: string[], dto: UpdateMeetingDto) {
    const meeting = await this.load(id);
    this.assertOrganizer(meeting, userId, roles);

    let participantOps: Prisma.MeetingUpdateInput['participants'] | undefined;
    if (dto.participantIds) {
      const wanted = [...new Set(dto.participantIds)].filter((p) => p !== meeting.organizerId);
      const current = meeting.participants.map((p) => p.userId);
      const toAdd = wanted.filter((w) => !current.includes(w));
      const toRemove = current.filter((c) => !wanted.includes(c));
      participantOps = {
        deleteMany: toRemove.length
          ? { userId: { in: toRemove } }
          : undefined,
        create: toAdd.map((uId) => ({ userId: uId })),
      };
      await this.notifications.notifyMany(toAdd, {
        type: NotificationType.MEETING_INVITATION,
        title: `Meeting invitation: ${meeting.title}`,
        entityType: EntityType.MEETING,
        entityId: id,
      });
    }

    const updated = await this.prisma.meeting.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        agenda: dto.agenda?.trim(),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        location: dto.location?.trim(),
        onlineLink: dto.onlineLink?.trim(),
        projectId: dto.projectId,
        participants: participantOps,
      },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.MEETING,
      entityId: id,
      action: 'UPDATED',
      summary: 'updated the meeting',
      actorId: userId,
    });

    if (dto.startsAt || dto.endsAt) {
      await this.notifications.notifyMany(
        updated.participants.map((p) => p.userId),
        {
          type: NotificationType.MEETING_REMINDER,
          title: `Meeting rescheduled: ${updated.title}`,
          body: new Date(updated.startsAt).toLocaleString(),
          entityType: EntityType.MEETING,
          entityId: id,
        },
      );
    }
    return updated;
  }

  async cancel(id: string, userId: string, roles: string[]) {
    const meeting = await this.load(id);
    this.assertOrganizer(meeting, userId, roles);
    await this.notifications.notifyMany(
      meeting.participants.map((p) => p.userId),
      {
        type: NotificationType.MEETING_REMINDER,
        title: `Meeting cancelled: ${meeting.title}`,
        entityType: EntityType.MEETING,
        entityId: id,
      },
    );
    await this.prisma.meeting.delete({ where: { id } });
    return { ok: true };
  }

  async rsvp(
    id: string,
    userId: string,
    roles: string[],
    response: MeetingResponse,
  ) {
    const meeting = await this.load(id);
    if (!this.canView(meeting, userId, roles)) {
      throw new ForbiddenException('You are not on this meeting');
    }
    const participant = meeting.participants.find((p) => p.userId === userId);
    if (!participant) {
      throw new BadRequestException('You are not a participant of this meeting');
    }
    await this.prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: { response, respondedAt: new Date() },
    });
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    await this.audit.record({
      entityType: EntityType.MEETING,
      entityId: id,
      action: 'RSVP',
      summary: `${actor?.fullName ?? 'A participant'} responded ${response.toLowerCase()}`,
      actorId: userId,
    });
    if (meeting.organizerId !== userId) {
      await this.notifications.notify({
        recipientId: meeting.organizerId,
        type: NotificationType.MEETING_INVITATION,
        title: `${actor?.fullName ?? 'Someone'} ${response.toLowerCase()} "${meeting.title}"`,
        entityType: EntityType.MEETING,
        entityId: id,
      });
    }
    return this.load(id);
  }

  async setAttendance(
    id: string,
    userId: string,
    roles: string[],
    entries: { userId: string; attended: boolean }[],
  ) {
    const meeting = await this.load(id);
    this.assertOrganizer(meeting, userId, roles);
    for (const e of entries) {
      await this.prisma.meetingParticipant.updateMany({
        where: { meetingId: id, userId: e.userId },
        data: { attended: e.attended },
      });
    }
    await this.audit.record({
      entityType: EntityType.MEETING,
      entityId: id,
      action: 'ATTENDANCE_RECORDED',
      summary: 'recorded attendance',
      actorId: userId,
    });
    return this.load(id);
  }

  async setMinutes(
    id: string,
    userId: string,
    roles: string[],
    minutes: string,
  ) {
    const meeting = await this.get(id, userId, roles); // any participant may edit
    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { minutes },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.MEETING,
      entityId: id,
      action: 'MINUTES_UPDATED',
      summary: 'updated the minutes',
      actorId: userId,
    });
    return updated;
  }

  async addActionItem(
    id: string,
    userId: string,
    roles: string[],
    dto: ActionItemDto,
  ) {
    const meeting = await this.get(id, userId, roles);
    const activity = await this.activities.create(userId, {
      title: dto.title,
      assignedToId: dto.assignedToId,
      dueAt: dto.dueAt,
      entityType: EntityType.MEETING,
      entityId: meeting.id,
    });
    await this.audit.record({
      entityType: EntityType.MEETING,
      entityId: id,
      action: 'ACTION_ITEM_ADDED',
      summary: `added action item "${dto.title}"`,
      actorId: userId,
    });
    return activity;
  }

  actionItems(id: string) {
    return this.activities.list({
      entityType: EntityType.MEETING,
      entityId: id,
    });
  }

  async mine(userId: string, upcomingOnly: boolean) {
    const now = new Date();
    return this.prisma.meeting.findMany({
      where: {
        OR: [{ organizerId: userId }, { participants: { some: { userId } } }],
        ...(upcomingOnly ? { endsAt: { gte: now } } : {}),
      },
      orderBy: { startsAt: 'asc' },
      include: DETAIL_INCLUDE,
      take: upcomingOnly ? 10 : 100,
    });
  }
}
