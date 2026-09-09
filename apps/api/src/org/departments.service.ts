import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './org.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.department.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true, teams: true } } },
    });
  }

  async get(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        teams: { orderBy: { name: 'asc' } },
        _count: { select: { members: true, teams: true } },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    const name = dto.name.trim();
    if (await this.prisma.department.findUnique({ where: { name } })) {
      throw new ConflictException('A department with this name already exists');
    }
    return this.prisma.department.create({
      data: { name, code: dto.code?.trim() || null, notes: dto.notes?.trim() || null },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.get(id);
    return this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.trim(),
        notes: dto.notes?.trim(),
        active: dto.active,
      },
    });
  }
}
