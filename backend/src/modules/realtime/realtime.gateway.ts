import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/redis.module';

export interface LocationPayload {
  task_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

/**
 * Realtime WebSocket gateway.
 *
 * Rooms:
 *  - user:{userId}          — private channel for a single user (notifications, task updates)
 *  - task:{taskId}          — channel for a task (location updates for that job)
 *  - role:admin             — broadcast to all admin/manager connections
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: '*', credentials: false },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  /** socket.id → userId */
  private readonly socketToUser = new Map<string, string>();

  private static readonly LOCATION_TTL = 300; // 5 menit

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  afterInit(server: Server) {
    this.logger.log('RealtimeGateway initialised');

    // Authenticate every incoming connection via JWT in handshake
    server.use((socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      try {
        const payload = this.jwtService.verify(token, {
          secret: this.config.get<string>('app.jwtSecret'),
        });
        (socket as any).userId = payload.sub;
        (socket as any).role = payload.role;
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    });
  }

  handleConnection(client: Socket) {
    const userId: string = (client as any).userId;
    const role: string = (client as any).role;

    this.socketToUser.set(client.id, userId);

    // Auto-join personal room
    void client.join(`user:${userId}`);

    // Auto-join role room for admins/managers
    if (['admin', 'super_admin', 'manager'].includes(role)) {
      void client.join('role:admin');
    }

    this.logger.debug(`Client connected: ${client.id} (user: ${userId}, role: ${role})`);
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    this.socketToUser.delete(client.id);
    this.logger.debug(`Client disconnected: ${client.id} (user: ${userId})`);
  }

  // ── CLIENT → SERVER events ───────────────────────────────────────────────────

  /** Technician sends their GPS location during a visit */
  @SubscribeMessage('technician:location')
  handleLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationPayload,
  ) {
    const userId: string = (client as any).userId;

    if (payload?.lat === undefined || payload.lng === undefined) {
      throw new WsException('Payload tidak valid: lat dan lng wajib diisi');
    }

    const enriched = { user_id: userId, ...payload };

    // Simpan posisi terakhir di Redis (TTL 5 menit)
    this.redis
      .setex(`location:${userId}`, RealtimeGateway.LOCATION_TTL, JSON.stringify({
        lat: payload.lat,
        lng: payload.lng,
        task_id: payload.task_id ?? null,
        accuracy: payload.accuracy ?? null,
        heading: payload.heading ?? null,
        speed: payload.speed ?? null,
        timestamp: payload.timestamp ?? new Date().toISOString(),
      }))
      .catch(() => {});

    // Forward to task room jika ada task_id
    if (payload.task_id) {
      this.server.to(`task:${payload.task_id}`).emit('technician:location', enriched);
    }

    // Broadcast ke semua admin/manager
    this.server.to('role:admin').emit('technician:location', enriched);
  }

  /** Subscribe to updates for a specific task */
  @SubscribeMessage('task:watch')
  handleWatchTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { task_id: string },
  ) {
    if (!payload?.task_id) {
      throw new WsException('task_id wajib diisi');
    }
    void client.join(`task:${payload.task_id}`);
    return { status: 'watching', task_id: payload.task_id };
  }

  @SubscribeMessage('task:unwatch')
  handleUnwatchTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { task_id: string },
  ) {
    void client.leave(`task:${payload.task_id}`);
    return { status: 'unwatched', task_id: payload.task_id };
  }

  // ── SERVER → CLIENT helpers (called from other services) ────────────────────

  /** Get last known location of a specific user from Redis */
  async getLastLocation(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const raw = await this.redis.get(`location:${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Get all active technician locations from Redis (keys matching location:*) */
  async getAllLocations(): Promise<Array<{ user_id: string } & Record<string, unknown>>> {
    try {
      const keys = await this.redis.keys('location:*');
      if (!keys.length) return [];
      const values = await this.redis.mget(...keys);
      return keys
        .map((key, i) => {
          if (!values[i]) return null;
          const userId = key.replace('location:', '');
          return { user_id: userId, ...JSON.parse(values[i]!) };
        })
        .filter(Boolean) as Array<{ user_id: string } & Record<string, unknown>>;
    } catch {
      return [];
    }
  }

  /** Push a task status change to all subscribers of that task + the assignee */
  emitTaskUpdated(taskId: string, data: Record<string, unknown>) {
    this.server.to(`task:${taskId}`).emit('task:updated', { task_id: taskId, ...data });
    this.server.to('role:admin').emit('task:updated', { task_id: taskId, ...data });
  }

  /** Push a notification to a specific user */
  emitNotification(userId: string, notification: Record<string, unknown>) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }

  /** Push notification to all admin/manager connections */
  emitAdminAlert(data: Record<string, unknown>) {
    this.server.to('role:admin').emit('admin:alert', data);
  }
}
