import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SosService } from './sos.service';

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
    @Inject(forwardRef(() => SosService))
    private readonly sosService: SosService,
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

    // Broadcast ke admin/manager
    this.server.to('admins').emit('sos:location_update', {
      alertId: payload.alertId,
      userId,
      lat: payload.lat,
      lng: payload.lng,
      batteryPct: payload.batteryPct,
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast SOS baru ke semua admin/manager
  broadcastSosActivated(alertId: string, userId: string, lat: number, lng: number) {
    this.server.to('admins').emit('sos:activated', { alertId, userId, lat, lng });
  }

  // Notify user bahwa SOS telah direspons
  notifyUserResponded(userId: string, alertId: string) {
    this.server.to(`user:${userId}`).emit('sos:responded', { alertId });
  }
}
