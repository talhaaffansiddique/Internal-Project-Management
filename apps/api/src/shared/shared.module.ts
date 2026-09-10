import { Global, Module } from '@nestjs/common';
import { StorageService } from '../storage/storage.service.js';
import { AuditService } from './audit.service.js';
import { NotificationsService } from './notifications.service.js';
import { FollowersService } from './followers.service.js';
import { AttachmentsService } from './attachments.service.js';
import { CommentsService } from './comments.service.js';
import { ActivitiesService } from './activities.service.js';
import { RemindersService } from './reminders.service.js';
import { SharedEntityController } from './shared.controller.js';
import {
  ActivitiesController,
  AdminOpsController,
  AttachmentsController,
  AuditController,
  CommentsController,
  NotificationsController,
} from './misc.controllers.js';

@Global()
@Module({
  controllers: [
    SharedEntityController,
    CommentsController,
    AttachmentsController,
    ActivitiesController,
    NotificationsController,
    AuditController,
    AdminOpsController,
  ],
  providers: [
    StorageService,
    AuditService,
    NotificationsService,
    FollowersService,
    AttachmentsService,
    CommentsService,
    ActivitiesService,
    RemindersService,
  ],
  exports: [
    AuditService,
    NotificationsService,
    FollowersService,
    AttachmentsService,
    CommentsService,
    ActivitiesService,
  ],
})
export class SharedModule {}
