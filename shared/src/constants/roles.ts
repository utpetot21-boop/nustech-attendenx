export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  KARYAWAN: 'karyawan',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  super_admin: [
    'settings:manage',
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'schedule:manage',
    'attendance:manage',
    'attendance:own',
    'leave:approve',
    'task:assign',
    'task:own',
    'report:view',
  ],
  admin: [
    'settings:manage',
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'schedule:manage',
    'attendance:manage',
    'attendance:own',
    'leave:approve',
    'task:assign',
    'task:own',
    'report:view',
  ],
  manager: [
    'users:read',
    'users:update',
    'schedule:manage',
    'attendance:manage',
    'attendance:own',
    'leave:approve',
    'task:assign',
    'task:own',
    'report:view',
  ],
  karyawan: [
    'attendance:own',
    'task:own',
  ],
};

export const SYSTEM_ROLES: Role[] = ['super_admin', 'admin', 'manager', 'karyawan'];
