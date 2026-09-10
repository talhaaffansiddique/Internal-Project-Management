import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivityStatus, NotificationType } from '@prisma/client';
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
    const sent = await this.runNow();
    if (sent > 0) this.logger.log(`Sent ${sent} activity reminder(s)`);
  }

  /** Also callable on demand via POST /admin/run-reminders. */
  async runNow(): Promise<number> {
    const now = new Date();
    const dueBefore = new Date(now.getTime() + DUE_SOON_MS);
    const cooldownBefore = new Date(now.getTime() - REMIND_COOLDOWN_MS);

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
    return activities.length;
  }
}
