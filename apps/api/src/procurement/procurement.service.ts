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
  ProcurementStatus,
  QuotationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../shared/audit.service.js';
import { NotificationsService } from '../shared/notifications.service.js';
import {
  CreateProcurementDto,
  CreateQuotationDto,
  ListProcurementQuery,
  UpdateProcurementDto,
  UpdateQuotationDto,
} from './procurement.dto.js';

const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'];
const prNo = (n: number) => `PR-${String(n).padStart(4, '0')}`;

const STAGE_ROLE: Record<string, string> = {
  SUBMITTED: 'SUPERVISOR',
  AWAITING_DIRECTOR: 'DIRECTOR',
  WITH_PURCHASING: 'PURCHASING_FINANCE',
  ORDERED: 'PURCHASING_FINANCE',
};

const DETAIL_INCLUDE = {
  requester: { select: { id: true, fullName: true, email: true } },
  department: { select: { id: true, name: true } },
  quotations: {
    orderBy: { createdAt: 'asc' },
    include: { createdBy: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.ProcurementRequestInclude;

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private isPrivileged(roles: string[]) {
    return roles.some((r) => PRIVILEGED.includes(r));
  }

  private async userIdsWithRole(roleKey: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { role: { key: roleKey } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  private canView(
    req: { requesterId: string; statusKey: ProcurementStatus },
    userId: string,
    roles: string[],
  ) {
    if (this.isPrivileged(roles)) return true;
    if (req.requesterId === userId) return true;
    const stageRole = STAGE_ROLE[req.statusKey];
    return !!stageRole && roles.includes(stageRole);
  }

  private assertStageActor(
    req: { statusKey: ProcurementStatus },
    expectedStatus: ProcurementStatus,
    requiredRole: string,
    roles: string[],
  ) {
    if (req.statusKey !== expectedStatus) {
      throw new BadRequestException(
        `This request is not at the "${expectedStatus}" stage`,
      );
    }
    if (!this.isPrivileged(roles) && !roles.includes(requiredRole)) {
      throw new ForbiddenException(`Requires the ${requiredRole} role`);
    }
  }

  private async load(id: string) {
    const r = await this.prisma.procurementRequest.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!r) throw new NotFoundException('Procurement request not found');
    return r;
  }

  async list(userId: string, roles: string[], query: ListProcurementQuery) {
    const where: Prisma.ProcurementRequestWhereInput = {};
    if (!this.isPrivileged(roles)) {
      const visibleStatuses = Object.entries(STAGE_ROLE)
        .filter(([, role]) => roles.includes(role))
        .map(([status]) => status as ProcurementStatus);
      where.OR = [
        { requesterId: userId },
        ...(visibleStatuses.length
          ? [{ statusKey: { in: visibleStatuses } }]
          : []),
      ];
    }
    if (query.view === 'mine') where.requesterId = userId;
    if (query.statusKey) where.statusKey = query.statusKey as ProcurementStatus;
    if (query.type) where.type = query.type;

    return this.prisma.procurementRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: DETAIL_INCLUDE,
    });
  }

  async get(id: string, userId: string, roles: string[]) {
    const r = await this.load(id);
    if (!this.canView(r, userId, roles)) {
      throw new ForbiddenException(
        'You are not authorized to view this request',
      );
    }
    return r;
  }

  async create(userId: string, dto: CreateProcurementDto) {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const request = await this.prisma.procurementRequest.create({
      data: {
        type: dto.type,
        itemDescription: dto.itemDescription.trim(),
        businessReason: dto.businessReason.trim(),
        quantity: dto.quantity?.trim() || null,
        requesterId: userId,
        departmentId: dto.departmentId ?? requester?.primaryDepartmentId ?? null,
        statusKey: ProcurementStatus.SUBMITTED,
      },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: request.id,
      action: 'CREATED',
      summary: `submitted procurement request ${prNo(request.number)}`,
      actorId: userId,
    });
    const supervisors = await this.userIdsWithRole('SUPERVISOR');
    await this.notifications.notifyMany(supervisors, {
      type: NotificationType.APPROVAL_REQUEST,
      title: `Procurement request awaiting review: ${request.itemDescription}`,
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: request.id,
    });
    return request;
  }

  async update(
    id: string,
    userId: string,
    roles: string[],
    dto: UpdateProcurementDto,
  ) {
    const r = await this.load(id);
    if (
      !this.isPrivileged(roles) &&
      r.requesterId !== userId
    ) {
      throw new ForbiddenException('Only the requester or an admin can edit this');
    }
    if (r.statusKey !== ProcurementStatus.SUBMITTED && !this.isPrivileged(roles)) {
      throw new BadRequestException('Can only edit while awaiting supervisor review');
    }
    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: {
        itemDescription: dto.itemDescription?.trim(),
        businessReason: dto.businessReason?.trim(),
        quantity: dto.quantity?.trim(),
      },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
      action: 'UPDATED',
      summary: 'edited request details',
      actorId: userId,
    });
    return updated;
  }

  async supervisorDecision(
    id: string,
    userId: string,
    roles: string[],
    decision: 'approve_to_purchasing' | 'forward_to_director' | 'reject',
    comment: string | undefined,
  ) {
    const r = await this.load(id);
    this.assertStageActor(r, ProcurementStatus.SUBMITTED, 'SUPERVISOR', roles);

    const next =
      decision === 'reject'
        ? ProcurementStatus.REJECTED
        : decision === 'forward_to_director'
          ? ProcurementStatus.AWAITING_DIRECTOR
          : ProcurementStatus.WITH_PURCHASING;

    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: { statusKey: next },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
      action: 'SUPERVISOR_DECISION',
      summary: `supervisor decision: ${decision.replace(/_/g, ' ')}${comment ? ` — ${comment}` : ''}`,
      actorId: userId,
      oldValue: r.statusKey,
      newValue: next,
      meta: comment ? { comment } : undefined,
    });
    await this.notifyStage(updated, userId, next, r.requesterId);
    return updated;
  }

  async directorDecision(
    id: string,
    userId: string,
    roles: string[],
    decision: 'approve' | 'reject',
    comment: string | undefined,
  ) {
    const r = await this.load(id);
    this.assertStageActor(
      r,
      ProcurementStatus.AWAITING_DIRECTOR,
      'DIRECTOR',
      roles,
    );
    const next =
      decision === 'approve'
        ? ProcurementStatus.WITH_PURCHASING
        : ProcurementStatus.REJECTED;

    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: { statusKey: next },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
      action: 'DIRECTOR_DECISION',
      summary: `director decision: ${decision}${comment ? ` — ${comment}` : ''}`,
      actorId: userId,
      oldValue: r.statusKey,
      newValue: next,
      meta: comment ? { comment } : undefined,
    });
    await this.notifyStage(updated, userId, next, r.requesterId);
    return updated;
  }

  private async notifyStage(
    req: { id: string; itemDescription: string },
    actorId: string,
    stage: ProcurementStatus,
    requesterId: string,
  ) {
    if (stage === ProcurementStatus.WITH_PURCHASING) {
      const ids = await this.userIdsWithRole('PURCHASING_FINANCE');
      await this.notifications.notifyMany(ids, {
        type: NotificationType.APPROVAL_REQUEST,
        title: `Ready for quotations: ${req.itemDescription}`,
        entityType: EntityType.PROCUREMENT_REQUEST,
        entityId: req.id,
      });
    } else if (stage === ProcurementStatus.AWAITING_DIRECTOR) {
      const ids = await this.userIdsWithRole('DIRECTOR');
      await this.notifications.notifyMany(ids, {
        type: NotificationType.APPROVAL_REQUEST,
        title: `Needs director approval: ${req.itemDescription}`,
        entityType: EntityType.PROCUREMENT_REQUEST,
        entityId: req.id,
      });
    }
    if (requesterId !== actorId) {
      await this.notifications.notify({
        recipientId: requesterId,
        type: NotificationType.STATUS_CHANGE,
        title: `Your request "${req.itemDescription}" is now ${stage.replace(/_/g, ' ').toLowerCase()}`,
        entityType: EntityType.PROCUREMENT_REQUEST,
        entityId: req.id,
      });
    }
  }

  async purchaseStatus(
    id: string,
    userId: string,
    roles: string[],
    statusKey: 'ORDERED' | 'DELIVERED',
  ) {
    const r = await this.load(id);
    const expected =
      statusKey === 'ORDERED'
        ? ProcurementStatus.WITH_PURCHASING
        : ProcurementStatus.ORDERED;
    this.assertStageActor(r, expected, 'PURCHASING_FINANCE', roles);
    if (statusKey === 'ORDERED') {
      const hasSelected = r.quotations.some(
        (q) => q.status === QuotationStatus.SELECTED,
      );
      if (!hasSelected) {
        throw new BadRequestException(
          'Select a quotation before marking the order placed',
        );
      }
    }
    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: { statusKey: statusKey as ProcurementStatus },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
      action: 'STATUS_CHANGED',
      summary: `changed status: ${r.statusKey} → ${statusKey}`,
      actorId: userId,
      oldValue: r.statusKey,
      newValue: statusKey,
    });
    if (r.requesterId !== userId) {
      await this.notifications.notify({
        recipientId: r.requesterId,
        type: NotificationType.STATUS_CHANGE,
        title: `Your request "${r.itemDescription}" was ${statusKey.toLowerCase()}`,
        entityType: EntityType.PROCUREMENT_REQUEST,
        entityId: id,
      });
    }
    return updated;
  }

  async addQuotation(
    id: string,
    userId: string,
    roles: string[],
    dto: CreateQuotationDto,
  ) {
    const r = await this.load(id);
    this.assertStageActor(
      r,
      ProcurementStatus.WITH_PURCHASING,
      'PURCHASING_FINANCE',
      roles,
    );
    await this.prisma.procurementQuotation.create({
      data: {
        requestId: id,
        vendorName: dto.vendorName.trim(),
        amount: dto.amount,
        quotationDate: dto.quotationDate ? new Date(dto.quotationDate) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        paymentTerms: dto.paymentTerms?.trim() || null,
        deliveryTime: dto.deliveryTime?.trim() || null,
        comments: dto.comments?.trim() || null,
        attachmentId: dto.attachmentId ?? null,
        createdById: userId,
      },
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
      action: 'QUOTATION_ADDED',
      summary: `added a quotation from ${dto.vendorName.trim()}`,
      actorId: userId,
    });
    return this.load(id);
  }

  async updateQuotation(
    quotationId: string,
    userId: string,
    roles: string[],
    dto: UpdateQuotationDto,
  ) {
    const q = await this.prisma.procurementQuotation.findUnique({
      where: { id: quotationId },
      include: { request: true },
    });
    if (!q) throw new NotFoundException('Quotation not found');
    this.assertStageActor(
      q.request,
      ProcurementStatus.WITH_PURCHASING,
      'PURCHASING_FINANCE',
      roles,
    );
    await this.prisma.procurementQuotation.update({
      where: { id: quotationId },
      data: {
        vendorName: dto.vendorName?.trim(),
        amount: dto.amount,
        quotationDate: dto.quotationDate ? new Date(dto.quotationDate) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        paymentTerms: dto.paymentTerms?.trim(),
        deliveryTime: dto.deliveryTime?.trim(),
        comments: dto.comments?.trim(),
      },
    });
    return this.load(q.requestId);
  }

  async selectQuotation(quotationId: string, userId: string, roles: string[]) {
    const q = await this.prisma.procurementQuotation.findUnique({
      where: { id: quotationId },
      include: { request: true },
    });
    if (!q) throw new NotFoundException('Quotation not found');
    this.assertStageActor(
      q.request,
      ProcurementStatus.WITH_PURCHASING,
      'PURCHASING_FINANCE',
      roles,
    );
    await this.prisma.$transaction([
      this.prisma.procurementQuotation.updateMany({
        where: { requestId: q.requestId },
        data: { status: QuotationStatus.REJECTED },
      }),
      this.prisma.procurementQuotation.update({
        where: { id: quotationId },
        data: { status: QuotationStatus.SELECTED },
      }),
    ]);
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: q.requestId,
      action: 'QUOTATION_SELECTED',
      summary: `selected the quotation from ${q.vendorName}`,
      actorId: userId,
    });
    return this.load(q.requestId);
  }

  async stats(userId: string, roles: string[]) {
    const list = await this.list(userId, roles, {});
    return list.reduce<Record<string, number>>((acc, r) => {
      acc[r.statusKey] = (acc[r.statusKey] ?? 0) + 1;
      return acc;
    }, {});
  }

  mine(userId: string) {
    return this.prisma.procurementRequest.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
      include: DETAIL_INCLUDE,
    });
  }
}
