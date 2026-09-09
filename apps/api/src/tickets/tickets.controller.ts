import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TicketsService } from './tickets.service.js';
import { TICKET_FORMS, getForm } from './forms.js';
import {
  CurrentUser,
  CurrentUserRoles,
} from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import {
  AssignTicketDto,
  CreateTicketDto,
  ListTicketsQuery,
  UpdateTicketDto,
} from './tickets.dto.js';

@Controller('ticket-forms')
export class TicketFormsController {
  @Get()
  all() {
    return Object.values(TICKET_FORMS);
  }

  @Get(':type')
  one(@Param('type') type: string) {
    return getForm(type) ?? null;
  }
}

@Controller()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('me/tickets')
  mine(@CurrentUser('id') userId: string) {
    return this.tickets.myTickets(userId);
  }

  // @Roles() with no args just makes the caller's roles available for
  // visibility filtering — it does not restrict access.
  @Get('tickets/stats')
  @Roles()
  stats(
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.tickets.stats(userId, roles);
  }

  @Get('tickets')
  @Roles()
  list(
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Query() query: ListTicketsQuery,
  ) {
    return this.tickets.list(userId, roles, query);
  }

  @Get('tickets/:id')
  @Roles()
  get(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
  ) {
    return this.tickets.get(id, userId, roles);
  }

  @Post('tickets')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTicketDto) {
    return this.tickets.create(userId, dto);
  }

  @Patch('tickets/:id')
  @Roles()
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: UpdateTicketDto,
  ) {
    return this.tickets.update(id, userId, roles, dto);
  }

  @Patch('tickets/:id/assignee')
  @Roles('ADMIN', 'SUPER_ADMIN')
  assign(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUserRoles() roles: string[],
    @Body() dto: AssignTicketDto,
  ) {
    return this.tickets.assign(id, userId, roles, dto.assigneeId);
  }
}
