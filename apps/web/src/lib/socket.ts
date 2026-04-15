import { io, type Socket } from 'socket.io-client';

// NEXT_PUBLIC_SOCKET_URL = base URL tanpa path (mis. https://api.appnustech.cloud)
// Fallback: strip /api/v1 dari API URL, atau pakai localhost
const BASE_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v\d+\/?$/, '')
    : 'http://localhost:3001');

let realtimeSocket: Socket | null = null;

export function getRealtimeSocket(): Socket {
  if (!realtimeSocket) {
    realtimeSocket = io(`${BASE_URL}/realtime`, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });
  }
  return realtimeSocket;
}

export function connectSocket(token: string): Socket {
  const s = getRealtimeSocket();
  (s as any).auth = { token };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  realtimeSocket?.disconnect();
  realtimeSocket = null;
}
