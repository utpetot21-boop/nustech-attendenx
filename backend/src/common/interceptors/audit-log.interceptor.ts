import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AuditLogEntity } from '../../modules/audit/entities/audit-log.entity';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  constructor(
    @InjectRepository(AuditLogEntity)
    private auditRepo: Repository<AuditLogEntity>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, body } = request as {
      method: string;
      url: string;
      user?: { id: string };
      ip: string;
      body: Record<string, unknown>;
    };

    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutating || !user?.id) return next.handle();

    const start = Date.now();

    return next.handle().pipe(
      tap(async (responseData: unknown) => {
        const duration = Date.now() - start;
        this.logger.log(
          `[${method}] ${url} | user: ${user.id} | ip: ${ip} | ${duration}ms`,
        );

        try {
          const entityInfo = this.extractEntityInfo(url);
          await this.auditRepo.save(
            this.auditRepo.create({
              user_id: user.id,
              action: `${method} ${url}`,
              entity_type: entityInfo.type,
              entity_id: entityInfo.id,
              new_data: method !== 'DELETE' ? (body as Record<string, unknown>) : null,
              ip_address: ip,
            }),
          );
        } catch {
          // Audit log tidak boleh crash app utama
          this.logger.warn('Gagal menyimpan audit log');
        }
      }),
    );
  }

  private extractEntityInfo(url: string): { type: string; id: string | undefined } {
    // Contoh URL: /api/v1/users/550e8400-...
    const parts = url.replace('/api/v1/', '').split('/');
    const uuidRegex = /^[0-9a-f-]{36}$/i;
    return {
      type: parts[0] ?? 'unknown',
      id: parts[1] && uuidRegex.test(parts[1]) ? parts[1] : undefined,
    };
  }
}
