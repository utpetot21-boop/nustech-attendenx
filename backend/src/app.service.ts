import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): object {
    return {
      status: 'ok',
      app: 'Nustech-AttendenX API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      timezone: 'WITA (UTC+8)',
    };
  }
}
