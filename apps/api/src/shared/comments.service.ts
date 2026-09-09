import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EntityType, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';
import { NotificationsService } from './notifications.service.js';
import { FollowersService } from './followers.service.js';
import { AttachmentsService } from './attachments.service.js';

interface PostCommentInput {
  body: string;
  mentions?: string[];
  attachmentIds?: string[];
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly followers: FollowersService,
    private readonly attachments: AttachmentsService,
  ) {}

  async post(
    entityType: EntityType,
    entityId: string,
    authorId: string,
    dto: PostCommentInput,
  ) {
    const mentionIds = [...new Set(dto.mentions ?? [])].filter(
      (id) => id !== authorId,
    );
    const validMentions = mentionIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: mentionIds } },
          select: { id: true },
        })
      : [];

    const comment = await this.prisma.comment.create({
      data: {
        entityType,
        entityId,
        authorId,
        body: dto.body.trim(),
        mentions: { create: validMentions.map((u) => ({ userId: u.id })) },
      },
      include: {
        author: { select: { id: true, fullName: true } },
        mentions: {
          include: { user: { select: { id: true, fullName: true } } },
        },
      },
    });

    if (dto.attachmentIds?.length) {
      await this.attachments.linkMany(
        dto.attachmentIds,
        entityType,
        entityId,
        authorId,
      );
    }

    // Mentioned users become followers and get a notification.
    for (const u of validMentions) {
      await this.followers.add(entityType, entityId, u.id, authorId);
      await this.notifications.notify({
        recipientId: u.id,
        type: NotificationType.MENTION,
        title: 'You were mentioned in a comment',
        body: dto.body.slice(0, 140),
        entityType,
        entityId,
      });
    }

    // Other followers get a general notification.
    const followerIds = await this.followers.followerIds(entityType, entityId);
    const alreadyNotified = new Set([
      authorId,
      ...validMentions.map((u) => u.id),
    ]);
    await this.notifications.notifyMany(
      followerIds.filter((id) => !alreadyNotified.has(id)),
      {
        type: NotificationType.GENERAL,
        title: 'New comment',
        body: dto.body.slice(0, 140),
        entityType,
        entityId,
      },
    );

    await this.audit.record({
      entityType,
      entityId,
      action: 'COMMENT_ADDED',
      summary: 'added a comment',
      actorId: authorId,
    });

    return comment;
  }

  async edit(id: string, actorId: string, body: string) {
    const c = await this.prisma.comment.findUnique({ where: { id } });
    if (!c || c.deletedAt) throw new NotFoundException('Comment not found');
    if (c.authorId !== actorId) {
      throw new ForbiddenException('You can only edit your own comment');
    }
    const updated = await this.prisma.comment.update({
      where: { id },
      data: { body: body.trim(), editedAt: new Date() },
    });
    await this.audit.record({
      entityType: c.entityType,
      entityId: c.entityId,
      action: 'COMMENT_EDITED',
      summary: 'edited a comment',
      actorId,
    });
    return updated;
  }

  async softDelete(id: string, actorId: string) {
    const c = await this.prisma.comment.findUnique({ where: { id } });
    if (!c || c.deletedAt) throw new NotFoundException('Comment not found');
    if (c.authorId !== actorId) {
      throw new ForbiddenException('You can only delete your own comment');
    }
    await this.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      entityType: c.entityType,
      entityId: c.entityId,
      action: 'COMMENT_DELETED',
      summary: 'deleted a comment',
      actorId,
    });
    return { ok: true };
  }

  /** Merged chronological stream: comments + audit events. */
  async chatter(entityType: EntityType, entityId: string) {
    const [comments, events] = await Promise.all([
      this.prisma.comment.findMany({
        where: { entityType, entityId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, fullName: true } },
          mentions: {
            include: { user: { select: { id: true, fullName: true } } },
          },
        },
      }),
      this.audit.listForEntity(entityType, entityId),
    ]);

    const stream = [
      ...comments.map((c) => ({
        kind: 'comment' as const,
        id: c.id,
        at: c.createdAt,
        author: c.author,
        body: c.body,
        editedAt: c.editedAt,
        mentions: c.mentions.map((m) => m.user),
      })),
      ...events
        .filter((e) => !e.action.startsWith('COMMENT_'))
        .map((e) => ({
          kind: 'event' as const,
          id: e.id,
          at: e.createdAt,
          actor: e.actor,
          action: e.action,
          summary: e.summary,
        })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    return stream;
  }
}
