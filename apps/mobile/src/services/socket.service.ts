/**
 * Socket.io client untuk mobile — namespace /realtime
 *
 * Penggunaan:
 *   socketService.connect(accessToken)
 *   socketService.emitLocation(payload)
 *   socketService.disconnect()
 */
import { io, type Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

// Production build WAJIB WSS (HTTPS origin). Dev build boleh HTTP/WS ke localhost.
if (!ENV_API_URL && !__DEV__) {
  throw new Error(
    'EXPO_PUBLIC_API_URL tidak di-set di production build (socket).',
  );
}
if (ENV_API_URL && !__DEV__ && !ENV_API_URL.startsWith('https://')) {
  throw new Error(
    'EXPO_PUBLIC_API_URL di production wajib HTTPS (socket). Current: ' + ENV_API_URL,
  );
}

const API_BASE_URL = ENV_API_URL || 'http://localhost:3001';

export interface LocationPayload {
  task_id?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

class SocketService {
  private socket: Socket | null = null;
  private locationInterval: ReturnType<typeof setInterval> | null = null;
  private locationProvider: (() => Promise<LocationPayload | null>) | null = null;

  // ── Connection ──────────────────────────────────────────────────────────────

  async connect(): Promise<Socket> {
    if (this.socket?.connected) return this.socket;

    const token = await SecureStore.getItemAsync('access_token');
    if (!token) throw new Error('No access token found');

    this.socket = io(`${API_BASE_URL}/realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      if (__DEV__) console.log('[Socket] Connected to /realtime', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      if (__DEV__) console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      if (__DEV__) console.warn('[Socket] Connection error:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    this.stopLocationTracking();
    this.socket?.disconnect();
    this.socket = null;
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ── Location tracking ───────────────────────────────────────────────────────

  /**
   * Mulai kirim GPS setiap 30 detik.
   * @param provider fungsi async yang mengembalikan koordinat GPS terkini
   */
  startLocationTracking(provider: () => Promise<LocationPayload | null>) {
    this.locationProvider = provider;

    if (this.locationInterval) return; // sudah berjalan

    // Kirim pertama kali langsung
    void this.sendLocation();

    // Lalu setiap 30 detik
    this.locationInterval = setInterval(() => {
      void this.sendLocation();
    }, 30_000);
  }

  stopLocationTracking() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
    this.locationProvider = null;
  }

  private async sendLocation() {
    if (!this.socket?.connected || !this.locationProvider) return;

    try {
      const payload = await this.locationProvider();
      if (payload) {
        this.socket.emit('technician:location', payload);
      }
    } catch (err) {
      if (__DEV__) console.warn('[Socket] Failed to send location:', err);
    }
  }

  // ── Manual emit ─────────────────────────────────────────────────────────────

  emitLocation(payload: LocationPayload) {
    if (!this.socket?.connected) return;
    this.socket.emit('technician:location', payload);
  }

  watchTask(taskId: string) {
    this.socket?.emit('task:watch', { task_id: taskId });
  }

  unwatchTask(taskId: string) {
    this.socket?.emit('task:unwatch', { task_id: taskId });
  }

  // ── Event listeners ─────────────────────────────────────────────────────────

  on(event: string, handler: (...args: any[]) => void) {
    this.socket?.on(event, handler);
  }

  off(event: string, handler?: (...args: any[]) => void) {
    this.socket?.off(event, handler);
  }
}

// Singleton
export const socketService = new SocketService();
