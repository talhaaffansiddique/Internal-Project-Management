import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  EntityType,
  NotificationType,
  Prisma,
  TicketVisibility,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../shared/audit.service.js';
import { NotificationsService } from '../shared/notifications.service.js';
import { FollowersService } from '../shared/followers.service.js';
import { getForm } from './forms.js';
import {
  CreateTicketDto,
  ListTicketsQuery,
  UpdateTicketDto,
} from './tickets.dto.js';

const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'];

const DETAIL_INCLUDE = {
  requester: { select: { id: true, fullName: true, email: true } },
  assignee: { select: { id: true, fullName: true, email: true } },
  team: { select: { id: true, name: true } },
  closedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly followers: FollowersService,
  ) {}

  private isPrivileged(roles: string[]) {
    return roles.some((r) => PRIVILEGED.includes(r));
  }

  private async myTeamIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    return rows.map((r) => r.teamId);
  }

  private async myFollowedTicketIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.follower.findMany({
      where: { entityType: EntityType.TICKET, userId },
      select: { entityId: true },
    });
    return rows.map((r) => r.entityId);
  }

  /** Prisma `where` fragment that limits results to what the caller may see (§8.3). */
  private async visibilityWhere(
    userId: string,
    roles: string[],
  ): Promise<Prisma.TicketWhereInput> {
    if (this.isPrivileged(roles)) return {};
    const [teamIds, followed] = await Promise.all([
      this.myTeamIds(userId),
      this.myFollowedTicketIds(userId),
    ]);
    return {
      OR: [
        { requesterId: userId },
        { assigneeId: userId },
        { id: { in: followed } },
        {
          AND: [
            { visibility: TicketVisibility.TEAM },
            { teamId: { in: teamIds } },
          ],
        },
      ],
    };
  }

  async list(userId: string, roles: string[], query: ListTicketsQuery) {
    const visibility = await this.visibilityWhere(userId, roles);
    const where: Prisma.TicketWhereInput = { AND: [visibility] };
    const and = where.AND as Prisma.TicketWhereInput[];

    if (query.type) and.push({ type: query.type });
    if (query.statusKey) and.push({ statusKey: query.statusKey });
    if (query.priority) and.push({ priority: query.priority });
    if (query.assigneeId) and.push({ assigneeId: query.assigneeId });
    if (query.teamId) and.push({ teamId: query.teamId });
    if (query.q) {
      and.push({
        OR: [
          { subject: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    switch (query.view) {
      case 'mine':
        and.push({ requesterId: userId });
        break;
      case 'team': {
        const teamIds = await this.myTeamIds(userId);
        and.push({ visibility: TicketVisibility.TEAM, teamId: { in: teamIds } });
        break;
      }
      case 'unassigned':
        and.push({ assigneeId: null });
        break;
      case 'following': {
        const followed = await this.myFollowedTicketIds(userId);
        and.push({ id: { in: followed } });
        break;
      }
    }

    return this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: DETAIL_INCLUDE,
      take: 200,
    });
  }

  async canView(ticketId: string, userId: string, roles: string[]) {
    if (this.isPrivileged(roles)) return true;
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { requesterId: true, assigneeId: true, visibility: true, teamId: true },
    });
    if (!ticket) return false;
    if (ticket.requesterId === userId || ticket.assigneeId === userId) return true;
    const followed = await this.prisma.follower.findFirst({
      where: { entityType: EntityType.TICKET, entityId: ticketId, userId },
      select: { id: true },
    });
    if (followed) return true;
    if (ticket.visibility === TicketVisibility.TEAM && ticket.teamId) {
      const member = await this.prisma.teamMember.findFirst({
        where: { teamId: ticket.teamId, userId },
        select: { id: true },
      });
      if (member) return true;
    }
    return false;
  }

  async get(id: string, userId: string, roles: string[]) {
    if (!(await this.canView(id, userId, roles))) {
      throw new ForbiddenException('You are not authorized to view this ticket');
    }
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return { ...ticket, form: getForm(ticket.type) ?? null };
  }

  private async validateMasterKey(typeKey: string, key: string, label: string) {
    const row = await this.prisma.masterDataValue.findFirst({
      where: { key, type: { key: typeKey }, active: true },
      select: { id: true },
    });
    if (!row) throw new BadRequestException(`Unknown ${label}: ${key}`);
  }

  async create(userId: string, dto: CreateTicketDto) {
    if (!getForm(dto.type)) {
      await this.validateMasterKey('ticket_types', dto.type, 'ticket type');
    }
    if (dto.priority) {
      await this.validateMasterKey('priorities', dto.priority, 'priority');
    }
    const visibility = dto.visibility ?? TicketVisibility.PRIVATE;
    if (visibility === TicketVisibility.TEAM && !dto.teamId) {
      throw new BadRequestException('A team ticket needs a team');
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        subject: dto.subject.trim(),
        type: dto.type,
        description: dto.description?.trim() || null,
        fields: (dto.fields ?? undefined) as Prisma.InputJsonValue | undefined,
        visibility,
        teamId: visibility === TicketVisibility.TEAM ? dto.teamId : null,
        priority: dto.priority ?? null,
        categoryId: dto.categoryId ?? null,
        requesterId: userId,
        statusKey: 'new',
      },
      include: DETAIL_INCLUDE,
    });

    await this.followers.add(EntityType.TICKET, ticket.id, userId);
    await this.audit.record({
      entityType: EntityType.TICKET,
      entityId: ticket.id,
      action: 'CREATED',
      summary: `raised ticket TKT-${String(ticket.number).padStart(4, '0')}`,
      actorId: userId,
    });
    return { ...ticket, form: getForm(ticket.type) ?? null };
  }

  async update(
    id: string,
    userId: string,
    roles: string[],
    dto: UpdateTicketDto,
  ) {
    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ticket not found');
    const mayEdit =
      this.isPrivileged(roles) ||
      existing.requesterId === userId ||
      existing.assigneeId === userId;
    if (!mayEdit) {
      throw new ForbiddenException('You cannot edit this ticket');
    }
    if (dto.priority) {
      await this.validateMasterKey('priorities', dto.priority, 'priority');
    }

    const nextVisibility = dto.visibility ?? existing.visibility;
    const nextTeamId =
      dto.teamId !== undefined ? dto.teamId : existing.teamId;
    if (nextVisibility === TicketVisibility.TEAM && !nextTeamId) {
      throw new BadRequestException('A team ticket needs a team');
    }

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        subject: dto.subject?.trim(),
        description: dto.description?.trim(),
        fields: (dto.fields ?? undefined) as Prisma.InputJsonValue | undefined,
        visibility: dto.visibility,
        teamId:
          nextVisibility === TicketVisibility.TEAM ? nextTeamId : null,
        priority: dto.priority,
        categoryId: dto.categoryId,
      },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.TICKET,
      entityId: id,
      action: 'UPDATED',
      summary: 'edited ticket details',
      actorId: userId,
    });
    return { ...ticket, form: getForm(ticket.type) ?? null };
  }

  async assign(
    id: string,
    userId: string,
    roles: string[],
    assigneeId: string | null | undefined,
  ) {
    if (!this.isPrivileged(roles)) {
      throw new ForbiddenException('Only an Admin can assign tickets');
    }
    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ticket not found');

    if (assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: assigneeId },
      });
      if (!assignee) throw new NotFoundException('Assignee not found');
    }

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        assigneeId: assigneeId ?? null,
        statusKey:
          assigneeId && existing.statusKey === 'new'
            ? 'assigned'
            : existing.statusKey,
      },
      include: DETAIL_INCLUDE,
    });

    if (assigneeId && assigneeId !== existing.assigneeId) {
      await this.followers.add(EntityType.TICKET, id, assigneeId, userId);
      if (assigneeId !== userId) {
        await this.notifications.notify({
          recipientId: assigneeId,
          type: NotificationType.ASSIGNMENT,
          title: `Ticket assigned to you: ${ticket.subject}`,
          entityType: EntityType.TICKET,
          entityId: id,
        });
      }
    }
    await this.audit.record({
      entityType: EntityType.TICKET,
      entityId: id,
      action: 'ASSIGNMENT_CHANGED',
      summary: assigneeId
        ? `assigned the ticket to ${ticket.assignee?.fullName ?? 'someone'}`
        : 'unassigned the ticket',
      actorId: userId,
      oldValue: existing.assigneeId,
      newValue: assigneeId ?? null,
    });
    return { ...ticket, form: getForm(ticket.type) ?? null };
  }

  async myTickets(userId: string) {
    const followed = await this.myFollowedTicketIds(userId);
    return this.prisma.ticket.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { assigneeId: userId },
          { id: { in: followed } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: DETAIL_INCLUDE,
    });
  }

  async stats(userId: string, roles: string[]) {
    const visibility = await this.visibilityWhere(userId, roles);
    const grouped = await this.prisma.ticket.groupBy({
      by: ['statusKey'],
      where: visibility,
      _count: { _all: true },
    });
    return grouped.reduce<Record<string, number>>((acc, g) => {
      acc[g.statusKey] = g._count._all;
      return acc;
    }, {});
  }
}
