import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Flatten NestJS exception response → message selalu string atau string[]
    const raw = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    let message: string | string[];
    if (typeof raw === 'string') {
      message = raw;
    } else if (typeof raw === 'object' && raw !== null) {
      const r = raw as Record<string, any>;
      const inner = r['message'] ?? r['error'] ?? 'An error occurred';
      message = Array.isArray(inner) ? inner : String(inner);
    } else {
      message = 'An error occurred';
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status}`);
    }

    response.status(status).json(errorResponse);
  }
}
