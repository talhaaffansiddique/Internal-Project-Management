import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateBranchDto,
  CreateDesignationDto,
  UpdateBranchDto,
  UpdateDesignationDto,
} from './org.dto.js';

@Injectable()
export class DesignationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.designation.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateDesignationDto) {
    const name = dto.name.trim();
    if (await this.prisma.designation.findUnique({ where: { name } })) {
      throw new ConflictException('A designation with this name already exists');
    }
    return this.prisma.designation.create({ data: { name } });
  }

  async update(id: string, dto: UpdateDesignationDto) {
    await this.exists(id);
    return this.prisma.designation.update({
      where: { id },
      data: { name: dto.name?.trim(), active: dto.active },
    });
  }

  async remove(id: string) {
    await this.exists(id);
    const inUse = await this.prisma.user.count({ where: { designationId: id } });
    if (inUse > 0) {
      throw new ConflictException(
        `In use by ${inUse} user(s) — deactivate it instead`,
      );
    }
    await this.prisma.designation.delete({ where: { id } });
    return { ok: true };
  }

  private async exists(id: string) {
    const row = await this.prisma.designation.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Designation not found');
  }
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.branch.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateBranchDto) {
    const name = dto.name.trim();
    if (await this.prisma.branch.findUnique({ where: { name } })) {
      throw new ConflictException('A branch with this name already exists');
    }
    return this.prisma.branch.create({
      data: { name, address: dto.address?.trim() || null },
    });
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.exists(id);
    return this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        address: dto.address?.trim(),
        active: dto.active,
      },
    });
  }

  async remove(id: string) {
    await this.exists(id);
    await this.prisma.branch.delete({ where: { id } });
    return { ok: true };
  }

  private async exists(id: string) {
    const row = await this.prisma.branch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Branch not found');
  }
}
