import { io, type Socket } from 'socket.io-client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
