import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  CurrentUserRoles,
} from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { MeetingsService } from './meetings.service.js';
import {
  ActionItemDto,
  CreateMeetingDto,
  ListMeetingsQuery,
  RsvpDto,
  SetAttendanceDto,
  SetMinutesDto,
  UpdateMeetingDto,
} from './meetings.dto.js';

@Controller()
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get('me/meetings')
  mine(
    @CurrentUser('id') userId: string,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.meetings.mine(userId, upcoming === 'true');
  }

  @Get('meetings')
  @Roles()
  list(
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Query() query: ListMeetingsQuery,
  ) {
    return this.meetings.list(userId, roles, query);
  }

  @Get('meetings/:id')
  @Roles()
  get(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.meetings.get(id, userId, roles);
  }

  @Get('meetings/:id/action-items')
  @Roles()
  actionItems(@Param('id') id: string) {
    return this.meetings.actionItems(id);
  }

  @Post('meetings')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateMeetingDto) {
    return this.meetings.create(userId, dto);
  }

  @Patch('meetings/:id')
  @Roles()
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetings.update(id, userId, roles, dto);
  }

  @Delete('meetings/:id')
  @Roles()
  cancel(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.meetings.cancel(id, userId, roles);
  }

  @Post('meetings/:id/rsvp')
  @Roles()
  rsvp(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: RsvpDto,
  ) {
    return this.meetings.rsvp(id, userId, roles, dto.response);
  }

  @Post('meetings/:id/attendance')
  @Roles()
  attendance(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: SetAttendanceDto,
  ) {
    return this.meetings.setAttendance(id, userId, roles, dto.attendance);
  }

  @Put('meetings/:id/minutes')
  @Roles()
  minutes(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: SetMinutesDto,
  ) {
    return this.meetings.setMinutes(id, userId, roles, dto.minutes);
  }

  @Post('meetings/:id/action-items')
  @Roles()
  addActionItem(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: ActionItemDto,
  ) {
    return this.meetings.addActionItem(id, userId, roles, dto);
  }
}
