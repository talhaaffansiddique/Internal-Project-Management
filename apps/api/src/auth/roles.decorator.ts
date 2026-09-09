import { SetMetadata } from '@nestjs/common';

/** Restrict a route to users holding at least one of the given role keys. */
export const ROLES_KEY = 'requiredRoles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
