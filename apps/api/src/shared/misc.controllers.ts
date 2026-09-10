import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EntityType } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { parseEntityType } from './entity.js';
import { CommentsService } from './comments.service.js';
import {
  AttachmentsService,
  UploadedFileLike,
} from './attachments.service.js';
import { ActivitiesService } from './activities.service.js';
import { NotificationsService } from './notifications.service.js';
import { AuditService } from './audit.service.js';
import { RemindersService } from './reminders.service.js';
import {
  CreateActivityDto,
  EditCommentDto,
  UpdateActivityDto,
} from './shared.dto.js';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Patch(':id')
  edit(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: EditCommentDto,
  ) {
    return this.comments.edit(id, userId, dto.body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.comments.softDelete(id, userId);
  }
}

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: UploadedFileLike | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided (form field name: "file")');
    }
    return this.attachments.upload(userId, file);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.attachments.get(id);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { attachment, stream } = await this.attachments.streamFor(id);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.originalFilename)}"`,
    );
    stream.pipe(res);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.attachments.remove(id, userId);
  }
}

@Controller()
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get('me/activities')
  mine(
    @CurrentUser('id') userId: string,
    @Query('includeDone') includeDone?: string,
  ) {
    return this.activities.listMine(userId, includeDone === 'true');
  }

  @Get('activities')
  list(
    @Query('assignedToId') assignedToId?: string,
    @Query('status') status?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.activities.list({
      assignedToId,
      status: status as never,
      entityType: entityType
        ? parseEntityType(entityType)
        : (undefined as unknown as EntityType | undefined),
      entityId,
    });
  }

  @Post('activities')
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activities.create(userId, {
      title: dto.title,
      assignedToId: dto.assignedToId,
      dueAt: dto.dueAt,
      entityType: dto.entityType
        ? parseEntityType(dto.entityType)
        : undefined,
      entityId: dto.entityId,
    });
  }

  @Patch('activities/:id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activities.update(id, userId, dto);
  }

  @Post('activities/:id/complete')
  complete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.activities.complete(id, userId);
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notifications.list(userId, unreadOnly === 'true');
  }

  @Get('unread-count')
  async count(@CurrentUser('id') userId: string) {
    return { count: await this.notifications.unreadCount(userId) };
  }

  @Post('read-all')
  readAll(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Post(':id/read')
  read(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notifications.markRead(userId, id);
  }
}

@Controller('admin')
export class AdminOpsController {
  constructor(private readonly reminders: RemindersService) {}

  @Post('run-reminders')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async runReminders() {
    return { sent: await this.reminders.runNow() };
  }
}

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  global(
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.listGlobal({
      entityType: entityType ? parseEntityType(entityType) : undefined,
      actorId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
