import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityType, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { WhatsAppService } from './whatsapp.service.js';

export interface NotifyInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: EntityType;
  entityId?: string;
}

/**
 * Record types eligible for a WhatsApp echo, on top of the in-app
 * notification: tickets, procurement, and any @mention. Extend this list
 * as more trigger events are approved (see BUILD_TASKS.md).
 */
function isWhatsAppEligible(type: NotificationType, entityType?: EntityType) {
  if (type === NotificationType.MENTION) return true;
  if (entityType === EntityType.TICKET) return true;
  if (entityType === EntityType.PROCUREMENT_REQUEST) return true;
  return false;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * A recipient only ever has one notification per record. If this
   * recipient already has a notification about the same record — read or
   * not — refresh it in place (new title/body, bumped to the top, marked
   * unread again) instead of stacking a duplicate. Otherwise a busy
   * thread (a ticket reassigned twice, a request moving stage after
   * stage) piles up one entry per event and the user has to click
   * through each one individually to reach the current state.
   */
  async notify(input: NotifyInput) {
    if (input.entityType && input.entityId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          recipientId: input.recipientId,
          entityType: input.entityType,
          entityId: input.entityId,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        const updated = await this.prisma.notification.update({
          where: { id: existing.id },
          data: {
            type: input.type,
            title: input.title,
            body: input.body,
            createdAt: new Date(),
            readAt: null,
          },
        });
        void this.relayToWhatsApp(input);
        return updated;
      }
    }
    const created = await this.prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
    void this.relayToWhatsApp(input);
    return created;
  }

  /**
   * Best-effort WhatsApp echo of an in-app notification — never throws,
   * never blocks/delays notify() itself.
   */
  private async relayToWhatsApp(input: NotifyInput) {
    if (!isWhatsAppEligible(input.type, input.entityType)) return;
    try {
      const recipient = await this.prisma.user.findUnique({
        where: { id: input.recipientId },
        select: { phoneNumber: true, whatsappOptIn: true },
      });
      if (!recipient?.whatsappOptIn || !recipient.phoneNumber) return;
      const message = input.body ? `${input.title}\n${input.body}` : input.title;
      await this.whatsapp.sendText(recipient.phoneNumber, message);
    } catch (err) {
      this.logger.error(`WhatsApp relay failed: ${(err as Error).message}`);
    }
  }

  async notifyMany(
    recipientIds: string[],
    input: Omit<NotifyInput, 'recipientId'>,
  ) {
    const unique = [...new Set(recipientIds)];
    if (unique.length === 0) return;
    await Promise.all(
      unique.map((recipientId) => this.notify({ ...input, recipientId })),
    );
  }

  list(userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({
      where: { id, recipientId: userId },
    });
    if (!n) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
