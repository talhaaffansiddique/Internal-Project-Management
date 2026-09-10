import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  CurrentUserRoles,
} from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { TrainingService } from './training.service.js';
import {
  AcknowledgeDto,
  AddParticipantDto,
  ChangeTrainingStatusDto,
  ChecklistItemDto,
  CreateTrainingDto,
  ListTrainingQuery,
  ToggleChecklistDto,
  UpdateTrainingDto,
} from './training.dto.js';

@Controller()
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Get('me/trainings')
  mine(@CurrentUser('id') userId: string) {
    return this.training.mine(userId);
  }

  @Get('trainings')
  @Roles()
  list(
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Query() query: ListTrainingQuery,
  ) {
    return this.training.list(userId, roles, query);
  }

  @Get('trainings/:id')
  @Roles()
  get(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.training.get(id, userId, roles);
  }

  @Post('trainings')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTrainingDto) {
    return this.training.create(userId, dto);
  }

  @Patch('trainings/:id')
  @Roles()
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: UpdateTrainingDto,
  ) {
    return this.training.update(id, userId, roles, dto);
  }

  @Post('trainings/:id/status')
  @Roles()
  changeStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: ChangeTrainingStatusDto,
  ) {
    return this.training.changeStatus(id, userId, roles, dto.statusKey);
  }

  @Post('trainings/:id/checklist')
  @Roles()
  addChecklist(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: ChecklistItemDto,
  ) {
    return this.training.addChecklistItem(id, userId, roles, dto.label);
  }

  @Patch('trainings/:id/checklist/:itemId')
  @Roles()
  toggleChecklist(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: ToggleChecklistDto,
  ) {
    return this.training.toggleChecklistItem(
      id,
      itemId,
      userId,
      roles,
      dto.done,
    );
  }

  @Delete('trainings/:id/checklist/:itemId')
  @Roles()
  removeChecklist(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.training.removeChecklistItem(id, itemId, userId, roles);
  }

  @Post('trainings/:id/participants')
  @Roles()
  addParticipant(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: AddParticipantDto,
  ) {
    return this.training.addParticipant(id, userId, roles, dto.userId);
  }

  @Delete('trainings/:id/participants/:participantId')
  @Roles()
  removeParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.training.removeParticipant(id, userId, roles, participantId);
  }

  @Post('trainings/:id/acknowledge')
  @Roles()
  acknowledge(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: AcknowledgeDto,
  ) {
    return this.training.acknowledge(
      id,
      userId,
      roles,
      dto.result,
      dto.comment,
    );
  }
}
