import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FollowersService {
  constructor(private readonly prisma: PrismaService) {}

  list(entityType: EntityType, entityId: string) {
    return this.prisma.follower.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async add(
    entityType: EntityType,
    entityId: string,
    userId: string,
    addedById?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.follower.upsert({
      where: {
        entityType_entityId_userId: { entityType, entityId, userId },
      },
      update: {},
      create: { entityType, entityId, userId, addedById: addedById ?? null },
    });
    return this.list(entityType, entityId);
  }

  async remove(entityType: EntityType, entityId: string, userId: string) {
    await this.prisma.follower.deleteMany({
      where: { entityType, entityId, userId },
    });
    return this.list(entityType, entityId);
  }

  async followerIds(
    entityType: EntityType,
    entityId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.follower.findMany({
      where: { entityType, entityId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }
}
