import { Injectable } from '@nestjs/common';
import { EntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditInput {
  entityType: EntityType;
  entityId: string;
  action: string;
  summary: string;
  actorId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  meta?: unknown;
}

/** Append-only audit trail (brief §17). Other modules call record(). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        summary: input.summary,
        actorId: input.actorId ?? null,
        oldValue: (input.oldValue ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        newValue: (input.newValue ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  listForEntity(entityType: EntityType, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, fullName: true } } },
    });
  }

  listGlobal(params: {
    entityType?: EntityType;
    actorId?: string;
    limit?: number;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(params.entityType ? { entityType: params.entityType } : {}),
        ...(params.actorId ? { actorId: params.actorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.limit ?? 100, 500),
      include: { actor: { select: { id: true, fullName: true } } },
    });
  }
}
