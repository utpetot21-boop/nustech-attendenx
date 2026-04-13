import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permissions';

/**
 * Tandai endpoint dengan permission yang dibutuhkan.
 * User harus punya SALAH SATU dari permission yang didaftarkan.
 *
 * @example
 * @RequirePermission('attendance:manage')
 * @RequirePermission('task:own', 'task:assign')  // salah satu cukup
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
