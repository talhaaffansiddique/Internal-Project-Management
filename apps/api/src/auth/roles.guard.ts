import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{
      user?: { id: string };
      userRoles?: string[];
    }>();
    if (!req.user?.id) throw new ForbiddenException();

    const rows = await this.prisma.userRole.findMany({
      where: { userId: req.user.id },
      include: { role: true },
    });
    const keys = rows.map((r) => r.role.key);
    req.userRoles = keys; // available to controllers via @CurrentUserRoles()

    if (!required.some((r) => keys.includes(r))) {
      throw new ForbiddenException(
        `Requires role: ${required.join(' or ')}`,
      );
    }
    return true;
  }
}
