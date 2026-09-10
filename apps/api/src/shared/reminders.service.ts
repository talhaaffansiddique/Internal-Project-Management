import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivityStatus, EntityType, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

const DUE_SOON_MS = 24 * 60 * 60 * 1000; // notify when due within 24h
const REMIND_COOLDOWN_MS = 20 * 60 * 60 * 1000; // at most ~1 reminder / day

/** Background reminders for activity due dates (brief §10, §15). */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    const r = await this.runNow();
    if (r.activities + r.meetings + r.trainings > 0) {
      this.logger.log(
        `Reminders sent — activities: ${r.activities}, meetings: ${r.meetings}, trainings: ${r.trainings}`,
      );
    }
  }

  /** Also callable on demand via POST /admin/run-reminders. */
  async runNow(): Promise<{
    activities: number;
    meetings: number;
    trainings: number;
  }> {
    const now = new Date();
    const dueBefore = new Date(now.getTime() + DUE_SOON_MS);
    const cooldownBefore = new Date(now.getTime() - REMIND_COOLDOWN_MS);

    // ---- Activity due-date reminders ----
    const activities = await this.prisma.activity.findMany({
      where: {
        status: ActivityStatus.OPEN,
        dueAt: { lte: dueBefore },
        OR: [
          { lastRemindedAt: null },
          { lastRemindedAt: { lt: cooldownBefore } },
        ],
      },
    });
    for (const a of activities) {
      const overdue = a.dueAt.getTime() < now.getTime();
      await this.notifications.notify({
        recipientId: a.assignedToId,
        type: NotificationType.ACTIVITY_DUE,
        title: overdue ? `Overdue: ${a.title}` : `Due soon: ${a.title}`,
        body: `Due ${a.dueAt.toLocaleString()}`,
        entityType: a.entityType ?? undefined,
        entityId: a.entityId ?? undefined,
      });
      await this.prisma.activity.update({
        where: { id: a.id },
        data: { lastRemindedAt: now },
      });
    }

    // ---- Meeting reminders (starting within 24h, not yet started) ----
    const meetings = await this.prisma.meeting.findMany({
      where: {
        startsAt: { gte: now, lte: dueBefore },
        OR: [
          { lastRemindedAt: null },
          { lastRemindedAt: { lt: cooldownBefore } },
        ],
      },
      include: { participants: { select: { userId: true } } },
    });
    for (const m of meetings) {
      const recipients = [
        m.organizerId,
        ...m.participants.map((p) => p.userId),
      ];
      await this.notifications.notifyMany(recipients, {
        type: NotificationType.MEETING_REMINDER,
        title: `Upcoming: ${m.title}`,
        body: m.startsAt.toLocaleString(),
        entityType: EntityType.MEETING,
        entityId: m.id,
      });
      await this.prisma.meeting.update({
        where: { id: m.id },
        data: { lastRemindedAt: now },
      });
    }

    // ---- Training reminders (scheduled within 24h, not yet run) ----
    const trainings = await this.prisma.training.findMany({
      where: {
        scheduledAt: { gte: now, lte: dueBefore },
        statusKey: { in: ['requested', 'scheduled'] },
        OR: [
          { lastRemindedAt: null },
          { lastRemindedAt: { lt: cooldownBefore } },
        ],
      },
      include: { participants: { select: { userId: true } } },
    });
    for (const tr of trainings) {
      const recipients = [
        tr.trainerId,
        ...tr.participants.map((p) => p.userId),
      ];
      await this.notifications.notifyMany(recipients, {
        type: NotificationType.MEETING_REMINDER,
        title: `Training soon: ${tr.topic}`,
        body: tr.scheduledAt?.toLocaleString(),
        entityType: EntityType.TRAINING,
        entityId: tr.id,
      });
      await this.prisma.training.update({
        where: { id: tr.id },
        data: { lastRemindedAt: now },
      });
    }

    return {
      activities: activities.length,
      meetings: meetings.length,
      trainings: trainings.length,
    };
  }
}
