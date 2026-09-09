import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { parseEntityType } from './entity.js';
import { CommentsService } from './comments.service.js';
import { FollowersService } from './followers.service.js';
import { AttachmentsService } from './attachments.service.js';
import { AuditService } from './audit.service.js';
import {
  AddFollowerDto,
  LinkAttachmentDto,
  PostCommentDto,
} from './shared.dto.js';

/**
 * Blocks that mount on any record via /:entityType/:entityId/...
 * Every route ends in a fixed keyword so it never shadows a module route.
 */
@Controller()
export class SharedEntityController {
  constructor(
    private readonly comments: CommentsService,
    private readonly followers: FollowersService,
    private readonly attachments: AttachmentsService,
    private readonly audit: AuditService,
  ) {}

  @Get(':entityType/:entityId/chatter')
  chatter(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.comments.chatter(parseEntityType(entityType), entityId);
  }

  @Post(':entityType/:entityId/comments')
  postComment(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: PostCommentDto,
  ) {
    return this.comments.post(
      parseEntityType(entityType),
      entityId,
      userId,
      dto,
    );
  }

  @Get(':entityType/:entityId/followers')
  listFollowers(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.followers.list(parseEntityType(entityType), entityId);
  }

  @Post(':entityType/:entityId/followers')
  addFollower(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddFollowerDto,
  ) {
    return this.followers.add(
      parseEntityType(entityType),
      entityId,
      dto.userId,
      userId,
    );
  }

  @Delete(':entityType/:entityId/followers/:userId')
  removeFollower(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Param('userId') userId: string,
  ) {
    return this.followers.remove(
      parseEntityType(entityType),
      entityId,
      userId,
    );
  }

  @Get(':entityType/:entityId/attachments')
  listAttachments(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.attachments.listForEntity(
      parseEntityType(entityType),
      entityId,
    );
  }

  @Post(':entityType/:entityId/attachments')
  linkAttachment(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: LinkAttachmentDto,
  ) {
    return this.attachments.linkToEntity(
      dto.attachmentId,
      parseEntityType(entityType),
      entityId,
    );
  }

  @Get(':entityType/:entityId/audit')
  entityAudit(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.audit.listForEntity(parseEntityType(entityType), entityId);
  }
}
