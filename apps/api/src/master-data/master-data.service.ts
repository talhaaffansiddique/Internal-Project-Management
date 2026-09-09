import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateValueDto, UpdateValueDto } from './master-data.dto.js';

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  listTypes() {
    return this.prisma.masterDataType.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { values: true } } },
    });
  }

  private async typeByKey(key: string) {
    const type = await this.prisma.masterDataType.findUnique({ where: { key } });
    if (!type) throw new NotFoundException(`Unknown master-data type: ${key}`);
    return type;
  }

  async listValues(typeKey: string, includeInactive: boolean) {
    const type = await this.typeByKey(typeKey);
    const values = await this.prisma.masterDataValue.findMany({
      where: {
        typeId: type.id,
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    return { type, values };
  }

  private slugify(input: string) {
    return (
      input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'value'
    );
  }

  private async uniqueKey(typeId: string, base: string) {
    let key = base;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const clash = await this.prisma.masterDataValue.findFirst({
        where: { typeId, key },
        select: { id: true },
      });
      if (!clash) return key;
      n += 1;
      key = `${base}_${n}`;
    }
  }

  private async nextSortOrder(typeId: string) {
    const agg = await this.prisma.masterDataValue.aggregate({
      where: { typeId },
      _max: { sortOrder: true },
    });
    return (agg._max.sortOrder ?? -1) + 1;
  }

  private async assertParentValid(
    typeId: string,
    allowsHierarchy: boolean,
    parentId: string,
    selfId?: string,
  ) {
    if (!allowsHierarchy) {
      throw new BadRequestException('This type does not support sub-values');
    }
    if (selfId && parentId === selfId) {
      throw new BadRequestException('A value cannot be its own parent');
    }
    const parent = await this.prisma.masterDataValue.findFirst({
      where: { id: parentId, typeId },
      select: { id: true },
    });
    if (!parent) {
      throw new BadRequestException('Parent value not found in this type');
    }
  }

  async createValue(typeKey: string, dto: CreateValueDto) {
    const type = await this.typeByKey(typeKey);
    if (dto.parentId) {
      await this.assertParentValid(type.id, type.allowsHierarchy, dto.parentId);
    }
    const key = await this.uniqueKey(
      type.id,
      this.slugify(dto.key || dto.label),
    );
    return this.prisma.masterDataValue.create({
      data: {
        typeId: type.id,
        key,
        label: dto.label.trim(),
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? (await this.nextSortOrder(type.id)),
        meta: (dto.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async updateValue(typeKey: string, id: string, dto: UpdateValueDto) {
    const type = await this.typeByKey(typeKey);
    const value = await this.prisma.masterDataValue.findFirst({
      where: { id, typeId: type.id },
    });
    if (!value) throw new NotFoundException('Value not found');

    if (dto.parentId) {
      await this.assertParentValid(
        type.id,
        type.allowsHierarchy,
        dto.parentId,
        id,
      );
    }

    return this.prisma.masterDataValue.update({
      where: { id },
      data: {
        label: dto.label?.trim(),
        active: dto.active,
        sortOrder: dto.sortOrder,
        parentId: dto.parentId === null ? null : dto.parentId,
        meta: dto.meta as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async reorder(typeKey: string, orderedIds: string[]) {
    const type = await this.typeByKey(typeKey);
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.masterDataValue.updateMany({
          where: { id, typeId: type.id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.listValues(typeKey, true);
  }

  async deleteValue(typeKey: string, id: string) {
    const type = await this.typeByKey(typeKey);
    const value = await this.prisma.masterDataValue.findFirst({
      where: { id, typeId: type.id },
      include: { _count: { select: { children: true } } },
    });
    if (!value) throw new NotFoundException('Value not found');
    if (value.isSystem) {
      throw new ConflictException(
        'System values cannot be deleted — deactivate it instead',
      );
    }
    if (value._count.children > 0) {
      throw new ConflictException('Remove its sub-values first');
    }
    await this.prisma.masterDataValue.delete({ where: { id } });
    return { ok: true };
  }
}
