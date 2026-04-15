import api from './api';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

export interface SosAlert {
  id: string;
  user_id: string;
  activated_at: string;
  resolved_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_address: string | null;
  battery_pct: number | null;
  status: 'active' | 'responded' | 'resolved' | 'cancelled';
}

let sosSocket: Socket | null = null;

export async function connectSosSocket(
  userId: string,
  role: string,
  onLocationUpdate: (data: any) => void,
  onSosActivated: (data: any) => void,
  onResponded: (data: any) => void,
): Promise<Socket> {
  const token = await SecureStore.getItemAsync('access_token');
  const baseUrl = String(apiClient.defaults.baseURL ?? '').replace('/api', '');

  sosSocket = io(`${baseUrl}/sos`, {
    auth: { userId, role, token },
    transports: ['websocket', 'polling'], // polling sebagai fallback
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  sosSocket.on('sos:location_update', onLocationUpdate);
  sosSocket.on('sos:activated', onSosActivated);
  sosSocket.on('sos:responded', onResponded);

  return sosSocket;
}

export function disconnectSosSocket() {
  sosSocket?.disconnect();
  sosSocket = null;
}

export function emitLocation(alertId: string, lat: number, lng: number, batteryPct?: number) {
  // C3: cek connected sebelum emit — SOS adalah fitur kritis, jangan silent fail
  if (!sosSocket?.connected) {
    console.warn('[SOS] Socket tidak terhubung — lokasi tidak terkirim. Menunggu reconnect.');
    return;
  }
  sosSocket.emit('sos:location', { alertId, lat, lng, batteryPct });
}

export async function activateSos(lat: number, lng: number, batteryPct?: number): Promise<SosAlert> {
  const res = await api.post('/sos/activate', { lat, lng, battery_pct: batteryPct });
  return res.data;
}

export async function cancelSos(): Promise<SosAlert> {
  const res = await api.post('/sos/cancel');
  return res.data;
}

export async function getMyActiveSos(): Promise<SosAlert | null> {
  const res = await api.get('/sos/me');
  return res.data;
}
