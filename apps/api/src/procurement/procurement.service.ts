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
  FinalApprovalDto,
  ListProcurementQuery,
  ReassignDto,
  SendForApprovalDto,
  StopPurchaseDto,
  UpdateProcurementDto,
  UpdateQuotationDto,
} from './procurement.dto.js';

const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'];
const prNo = (n: number) => `PR-${String(n).padStart(4, '0')}`;

const STAGE_ROLE: Record<string, string> = {
  SUBMITTED: 'SUPERVISOR',
  AWAITING_DIRECTOR: 'DIRECTOR',
  WITH_PURCHASING: 'PURCHASING_FINANCE',
  AWAITING_FINAL_APPROVAL: 'DIRECTOR',
  ORDERED: 'PURCHASING_FINANCE',
};

/** Stages at which the Director retains a standing stop/re-assign override. */
const STOPPABLE_STAGES: ProcurementStatus[] = [
  ProcurementStatus.WITH_PURCHASING,
  ProcurementStatus.AWAITING_FINAL_APPROVAL,
  ProcurementStatus.ORDERED,
];

const DETAIL_INCLUDE = {
  requester: { select: { id: true, fullName: true, email: true } },
  assignedTo: { select: { id: true, fullName: true, email: true } },
  department: { select: { id: true, name: true } },
  items: { orderBy: { createdAt: 'asc' } },
  quotations: {
    orderBy: { createdAt: 'asc' },
    include: { createdBy: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.ProcurementRequestInclude;

/** Short "3x Router, Installation service, +1 more" style summary for lists/notifications. */
function summarizeItems(items: { description: string }[]): string {
  if (items.length === 0) return '(no items)';
  const [first, ...rest] = items;
  return rest.length ? `${first.description} +${rest.length} more` : first.description;
}

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
    req: {
      requesterId: string;
      assignedToId: string | null;
      statusKey: ProcurementStatus;
    },
    userId: string,
    roles: string[],
  ) {
    if (this.isPrivileged(roles)) return true;
    if (req.requesterId === userId) return true;
    if (req.assignedToId === userId) return true;
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

  /**
   * Gate for the Purchasing/Finance-stage actions (add/select quotations,
   * send for approval, mark delivered). If the request has an assigned RFQ
   * owner, only they (or a privileged admin) may act; otherwise falls back
   * to "any Purchasing/Finance user" (legacy / unassigned requests).
   */
  private assertPurchasingActor(
    req: { statusKey: ProcurementStatus; assignedToId: string | null },
    expectedStatus: ProcurementStatus,
    userId: string,
    roles: string[],
  ) {
    if (req.statusKey !== expectedStatus) {
      throw new BadRequestException(
        `This request is not at the "${expectedStatus}" stage`,
      );
    }
    if (this.isPrivileged(roles)) return;
    if (req.assignedToId) {
      if (req.assignedToId !== userId) {
        throw new ForbiddenException(
          'Only the Purchasing/Finance user assigned to this request can do this',
        );
      }
      return;
    }
    if (!roles.includes('PURCHASING_FINANCE')) {
      throw new ForbiddenException('Requires the PURCHASING_FINANCE role');
    }
  }

  private async assertPurchasingFinanceUser(userId: string) {
    const hasRole = await this.prisma.userRole.findFirst({
      where: { userId, role: { key: 'PURCHASING_FINANCE' } },
    });
    if (!hasRole) {
      throw new BadRequestException(
        'The assigned user must have the Purchasing/Finance role',
      );
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
        { assignedToId: userId },
        ...(visibleStatuses.length
          ? [{ statusKey: { in: visibleStatuses } }]
          : []),
      ];
    }
    if (query.view === 'mine') where.requesterId = userId;
    if (query.statusKey) where.statusKey = query.statusKey as ProcurementStatus;
    if (query.type) where.items = { some: { type: query.type } };

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
    if (dto.assignedToId) {
      await this.assertPurchasingFinanceUser(dto.assignedToId);
    }
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const request = await this.prisma.procurementRequest.create({
      data: {
        businessReason: dto.businessReason.trim(),
        requesterId: userId,
        departmentId: dto.departmentId ?? requester?.primaryDepartmentId ?? null,
        assignedToId: dto.assignedToId ?? null,
        statusKey: ProcurementStatus.SUBMITTED,
        items: {
          create: dto.items.map((i) => ({
            type: i.type,
            description: i.description.trim(),
            quantity: i.quantity?.trim() || null,
          })),
        },
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
      title: `Procurement request awaiting review: ${summarizeItems(request.items)}`,
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
        businessReason: dto.businessReason?.trim(),
        ...(dto.items
          ? {
              items: {
                deleteMany: {},
                create: dto.items.map((i) => ({
                  type: i.type,
                  description: i.description.trim(),
                  quantity: i.quantity?.trim() || null,
                })),
              },
            }
          : {}),
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
    req: { id: string; items: { description: string }[] },
    actorId: string,
    stage: ProcurementStatus,
    requesterId: string,
  ) {
    const summary = summarizeItems(req.items);
    if (stage === ProcurementStatus.WITH_PURCHASING) {
      const ids = await this.userIdsWithRole('PURCHASING_FINANCE');
      await this.notifications.notifyMany(ids, {
        type: NotificationType.APPROVAL_REQUEST,
        title: `Ready for quotations: ${summary}`,
        entityType: EntityType.PROCUREMENT_REQUEST,
        entityId: req.id,
      });
    } else if (stage === ProcurementStatus.AWAITING_DIRECTOR) {
      const ids = await this.userIdsWithRole('DIRECTOR');
      await this.notifications.notifyMany(ids, {
        type: NotificationType.APPROVAL_REQUEST,
        title: `Needs director approval: ${summary}`,
        entityType: EntityType.PROCUREMENT_REQUEST,
        entityId: req.id,
      });
    } else if (stage === ProcurementStatus.AWAITING_FINAL_APPROVAL) {
      const ids = await this.userIdsWithRole('DIRECTOR');
      await this.notifications.notifyMany(ids, {
        type: NotificationType.APPROVAL_REQUEST,
        title: `Final approval needed (quotation selected): ${summary}`,
        entityType: EntityType.PROCUREMENT_REQUEST,
        entityId: req.id,
      });
    }
    if (requesterId !== actorId) {
      await this.notifications.notify({
        recipientId: requesterId,
        type: NotificationType.STATUS_CHANGE,
        title: `Your request "${summary}" is now ${stage.replace(/_/g, ' ').toLowerCase()}`,
        entityType: EntityType.PROCUREMENT_REQUEST,
        entityId: req.id,
      });
    }
  }

  async purchaseStatus(
    id: string,
    userId: string,
    roles: string[],
    statusKey: 'DELIVERED',
  ) {
    const r = await this.load(id);
    this.assertPurchasingActor(r, ProcurementStatus.ORDERED, userId, roles);
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
        title: `Your request "${summarizeItems(r.items)}" was ${statusKey.toLowerCase()}`,
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
    this.assertPurchasingActor(r, ProcurementStatus.WITH_PURCHASING, userId, roles);
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
    this.assertPurchasingActor(
      q.request,
      ProcurementStatus.WITH_PURCHASING,
      userId,
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
    this.assertPurchasingActor(
      q.request,
      ProcurementStatus.WITH_PURCHASING,
      userId,
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

  /** Assigned RFQ owner (or admin) is done gathering quotes — sends the selected one to the Director for final approval. */
  async sendForApproval(
    id: string,
    userId: string,
    roles: string[],
    dto: SendForApprovalDto,
  ) {
    const r = await this.load(id);
    this.assertPurchasingActor(r, ProcurementStatus.WITH_PURCHASING, userId, roles);
    const hasSelected = r.quotations.some(
      (q) => q.status === QuotationStatus.SELECTED,
    );
    if (!hasSelected) {
      throw new BadRequestException(
        'Select a quotation before sending for approval',
      );
    }
    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: { statusKey: ProcurementStatus.AWAITING_FINAL_APPROVAL },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
      action: 'SENT_FOR_APPROVAL',
      summary: `sent the selected quotation for director approval${dto.comment ? ` — ${dto.comment}` : ''}`,
      actorId: userId,
      oldValue: r.statusKey,
      newValue: updated.statusKey,
      meta: dto.comment ? { comment: dto.comment } : undefined,
    });
    await this.notifyStage(
      updated,
      userId,
      ProcurementStatus.AWAITING_FINAL_APPROVAL,
      r.requesterId,
    );
    return updated;
  }

  /** Director's first-time review of the selected quotation: approve places the order, reject cancels the request. */
  async finalApproval(
    id: string,
    userId: string,
    roles: string[],
    dto: FinalApprovalDto,
  ) {
    const r = await this.load(id);
    this.assertStageActor(
      r,
      ProcurementStatus.AWAITING_FINAL_APPROVAL,
      'DIRECTOR',
      roles,
    );
    const next =
      dto.decision === 'approve'
        ? ProcurementStatus.ORDERED
        : ProcurementStatus.REJECTED;
    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: { statusKey: next },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
      action: 'FINAL_APPROVAL',
      summary: `director final decision: ${dto.decision}${dto.comment ? ` — ${dto.comment}` : ''}`,
      actorId: userId,
      oldValue: r.statusKey,
      newValue: next,
      meta: dto.comment ? { comment: dto.comment } : undefined,
    });
    const summary = summarizeItems(r.items);
    const recipients = [...new Set([r.requesterId, r.assignedToId])].filter(
      (uid): uid is string => !!uid && uid !== userId,
    );
    await this.notifications.notifyMany(recipients, {
      type: NotificationType.STATUS_CHANGE,
      title:
        dto.decision === 'approve'
          ? `Order approved & placed: "${summary}"${dto.comment ? ` — ${dto.comment}` : ''}`
          : `Purchase rejected: "${summary}"${dto.comment ? ` — ${dto.comment}` : ''}`,
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
    });
    return updated;
  }

  /**
   * Director's standing override, available any time while the request is
   * being purchased (quotes gathered, awaiting final approval, or already
   * ordered) — cancels the purchase outright, with a mandatory comment.
   */
  async stopPurchase(
    id: string,
    userId: string,
    roles: string[],
    dto: StopPurchaseDto,
  ) {
    const r = await this.load(id);
    if (!STOPPABLE_STAGES.includes(r.statusKey)) {
      throw new BadRequestException(
        'This request cannot be stopped at its current stage',
      );
    }
    if (!this.isPrivileged(roles) && !roles.includes('DIRECTOR')) {
      throw new ForbiddenException('Requires the DIRECTOR role');
    }
    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: { statusKey: ProcurementStatus.REJECTED },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
      action: 'STOPPED',
      summary: `stopped the purchase — ${dto.comment}`,
      actorId: userId,
      oldValue: r.statusKey,
      newValue: ProcurementStatus.REJECTED,
      meta: { comment: dto.comment },
    });
    const summary = summarizeItems(r.items);
    const recipients = [...new Set([r.requesterId, r.assignedToId])].filter(
      (uid): uid is string => !!uid && uid !== userId,
    );
    await this.notifications.notifyMany(recipients, {
      type: NotificationType.STATUS_CHANGE,
      title: `Purchase stopped by the Director: "${summary}" — ${dto.comment}`,
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
    });
    return updated;
  }

  /**
   * Director's standing override to swap who owns RFQ/purchasing for this
   * request, available at the same stages as stopPurchase.
   */
  async reassign(
    id: string,
    userId: string,
    roles: string[],
    dto: ReassignDto,
  ) {
    const r = await this.load(id);
    if (!STOPPABLE_STAGES.includes(r.statusKey)) {
      throw new BadRequestException(
        'This request cannot be re-assigned at its current stage',
      );
    }
    if (!this.isPrivileged(roles) && !roles.includes('DIRECTOR')) {
      throw new ForbiddenException('Requires the DIRECTOR role');
    }
    await this.assertPurchasingFinanceUser(dto.assignedToId);
    const oldAssigneeId = r.assignedToId;
    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: { assignedToId: dto.assignedToId },
      include: DETAIL_INCLUDE,
    });
    await this.audit.record({
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
      action: 'REASSIGNED',
      summary: `re-assigned the Purchasing/Finance owner${dto.comment ? ` — ${dto.comment}` : ''}`,
      actorId: userId,
      oldValue: oldAssigneeId,
      newValue: dto.assignedToId,
      meta: dto.comment ? { comment: dto.comment } : undefined,
    });
    const summary = summarizeItems(r.items);
    const recipients = [
      ...new Set([oldAssigneeId, dto.assignedToId, r.requesterId]),
    ].filter((uid): uid is string => !!uid && uid !== userId);
    await this.notifications.notifyMany(recipients, {
      type: NotificationType.GENERAL,
      title: `Purchasing owner changed for "${summary}"${dto.comment ? `: ${dto.comment}` : ''}`,
      entityType: EntityType.PROCUREMENT_REQUEST,
      entityId: id,
    });
    return updated;
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
