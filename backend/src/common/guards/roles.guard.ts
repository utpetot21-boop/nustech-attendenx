import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Tidak ada pembatasan → izinkan
    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!requiredRoles || requiredRoles.length === 0)
    ) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user?.role) {
      throw new ForbiddenException('Akses ditolak: role tidak ditemukan');
    }

    // ── Permission-based check (sistem baru) ─────────────────────
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions: string[] = user.role.permissions ?? [];
      const hasPermission = requiredPermissions.some((p) => userPermissions.includes(p));
      if (!hasPermission) {
        throw new ForbiddenException(
          `Akses ditolak: diperlukan permission [${requiredPermissions.join(' atau ')}]`,
        );
      }
      return true;
    }

    // ── Role-name check (sistem lama, fallback) ───────────────────
    const hasRole = requiredRoles!.includes(user.role.name);
    if (!hasRole) {
      throw new ForbiddenException(
        `Akses ditolak: diperlukan role [${requiredRoles!.join(', ')}]`,
      );
    }
    return true;
  }
}
