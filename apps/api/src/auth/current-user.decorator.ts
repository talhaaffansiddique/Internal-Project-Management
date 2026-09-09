import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Injects the authenticated user (set by JwtAuthGuard).
 *   @CurrentUser() user: AuthUser
 *   @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return data ? req.user?.[data] : req.user;
  },
);

/**
 * Injects the current user's role keys (set by RolesGuard).
 * Only populated on routes decorated with @Roles(...).
 */
export const CurrentUserRoles = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ userRoles?: string[] }>();
    return req.userRoles ?? [];
  },
);
