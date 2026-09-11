import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateUserDto,
  UpdateUserDto,
  ListUsersQuery,
  UserStatusDto,
} from './users.dto.js';

const PRIVILEGED_ROLES = ['ADMIN', 'SUPER_ADMIN'];

const USER_INCLUDE = {
  roles: { include: { role: true } },
  primaryDepartment: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  supervisor: { select: { id: true, fullName: true } },
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private view(u: UserWithRelations) {
    const { passwordHash: _p, roles, ...rest } = u;
    return {
      ...rest,
      roles: roles.map((r) => ({ key: r.role.key, name: r.role.name })),
    };
  }

  async list(params: ListUsersQuery) {
    const where: Prisma.UserWhereInput = {};
    if (params.q) {
      where.OR = [
        { fullName: { contains: params.q, mode: 'insensitive' } },
        { email: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    if (params.departmentId) where.primaryDepartmentId = params.departmentId;
    if (params.status) where.status = params.status;
    if (params.roleKey) {
      where.roles = { some: { role: { key: params.roleKey } } };
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: USER_INCLUDE,
    });
    return users.map((u) => this.view(u));
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: USER_INCLUDE,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.view(user);
  }

  async lookup(q: string, role?: string) {
    return this.prisma.user.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(role ? { roles: { some: { role: { key: role } } } } : {}),
      },
      take: 20,
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, email: true },
    });
  }

  private async resolveRoles(roleKeys: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { key: { in: roleKeys } },
    });
    if (roles.length !== roleKeys.length) {
      const found = roles.map((r) => r.key);
      throw new BadRequestException(
        `Unknown role(s): ${roleKeys.filter((k) => !found.includes(k)).join(', ')}`,
      );
    }
    return roles;
  }

  private assertMayGrant(actorRoles: string[], roleKeys: string[]) {
    if (
      roleKeys.some((k) => PRIVILEGED_ROLES.includes(k)) &&
      !actorRoles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only a Super Admin can grant the Admin or Super Admin role',
      );
    }
  }

  private async assertMayManage(actorRoles: string[], targetId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: { roles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException('User not found');
    const targetKeys = target.roles.map((r) => r.role.key);
    if (
      targetKeys.includes('SUPER_ADMIN') &&
      !actorRoles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only a Super Admin can modify a Super Admin account',
      );
    }
  }

  async create(actorRoles: string[], dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('A user with this email already exists');
    }

    const roleKeys = dto.roleKeys?.length ? dto.roleKeys : ['EMPLOYEE'];
    this.assertMayGrant(actorRoles, roleKeys);
    const roles = await this.resolveRoles(roleKeys);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        status: 'INVITED',
        primaryDepartmentId: dto.primaryDepartmentId ?? null,
        designationId: dto.designationId ?? null,
        supervisorId: dto.supervisorId ?? null,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
      include: USER_INCLUDE,
    });
    return this.view(user);
  }

  async update(actorRoles: string[], id: string, dto: UpdateUserDto) {
    await this.assertMayManage(actorRoles, id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        primaryDepartmentId: dto.primaryDepartmentId,
        designationId: dto.designationId,
        supervisorId: dto.supervisorId,
      },
      include: USER_INCLUDE,
    });
    return this.view(user);
  }

  async setStatus(actorRoles: string[], id: string, status: UserStatusDto) {
    await this.assertMayManage(actorRoles, id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      include: USER_INCLUDE,
    });
    return this.view(user);
  }

  async setRoles(actorRoles: string[], id: string, roleKeys: string[]) {
    await this.assertMayManage(actorRoles, id);
    this.assertMayGrant(actorRoles, roleKeys);
    const roles = await this.resolveRoles(roleKeys);

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: roles.map((r) => ({ userId: id, roleId: r.id })),
      }),
    ]);
    return this.get(id);
  }
}
