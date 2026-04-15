import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SosService } from './sos.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

interface LocationPayload {
  alertId: string;
  lat: number;
  lng: number;
  batteryPct?: number;
}

@WebSocketGateway({
  namespace: '/sos',
  cors: { origin: '*' },
})
export class SosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly sosService: SosService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string;
    if (userId) client.join(`user:${userId}`);
    // Admin/manager join admin room
    const role = client.handshake.auth?.role as string;
    if (role === 'admin' || role === 'manager') client.join('admins');
  }

  handleDisconnect(_client: Socket) {}

  // Karyawan kirim lokasi setiap 15 detik
  @SubscribeMessage('sos:location')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationPayload,
  ) {
    const userId = client.handshake.auth?.userId as string;
    if (!userId || !payload.alertId) return;

    await this.sosService.updateLocation(
      userId,
      payload.alertId,
      payload.lat,
      payload.lng,
      payload.batteryPct,
    );

    const locationData = {
      alertId: payload.alertId,
      userId,
      lat: payload.lat,
      lng: payload.lng,
      batteryPct: payload.batteryPct,
      timestamp: new Date().toISOString(),
    };

    // Broadcast ke /sos namespace (mobile admin/manager)
    this.server.to('admins').emit('sos:location_update', locationData);
    // Forward ke /realtime namespace (web dashboard)
    this.realtimeGateway.emitAdminAlert({ type: 'sos:location_update', ...locationData });
  }

  // Broadcast SOS baru ke semua admin/manager
  broadcastSosActivated(alertId: string, userId: string, lat: number, lng: number) {
    const data = { alertId, userId, lat, lng };
    this.server.to('admins').emit('sos:activated', data);
    // Forward ke /realtime namespace (web dashboard)
    this.realtimeGateway.emitAdminAlert({ type: 'sos:activated', ...data });
  }

  // Notify user bahwa SOS telah direspons
  notifyUserResponded(userId: string, alertId: string) {
    this.server.to(`user:${userId}`).emit('sos:responded', { alertId });
    this.realtimeGateway.emitAdminAlert({ type: 'sos:responded', userId, alertId });
  }
}
