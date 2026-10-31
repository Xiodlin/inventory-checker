import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../api/middleware/auth.js';

export class Realtime {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, string>();
  constructor(server: Server, secret: string, origins: string | readonly string[]) {
    const allowedOrigins = new Set(typeof origins === 'string' ? [origins] : origins);
    this.wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
    this.wss.on('connection', (socket, request) => {
      socket.on('error', () => {});
      if (request.headers.origin && !allowedOrigins.has(request.headers.origin)) { socket.close(1008, 'Origin denied'); return; }
      // Tokens are accepted only in the first message, never in a URL or query string.
      if (request.url?.includes('?')) { socket.close(1008, 'Query strings not allowed'); return; }
      const authTimer = setTimeout(() => socket.close(1008, 'Authentication timed out'), 5000);
      let expirationTimer: NodeJS.Timeout | undefined;
      socket.on('message', data => {
        if (this.clients.has(socket)) return;
        try {
          const message = JSON.parse(data.toString());
          if (message.type !== 'auth' || typeof message.token !== 'string') throw new Error('Invalid auth');
          const auth = verifyToken(message.token, secret);
          this.clients.set(socket, auth.userId);
          clearTimeout(authTimer);
          expirationTimer = setTimeout(() => socket.close(1008, 'Token expired'), Math.min(auth.expiresAt - Date.now(), 2147483647));
          socket.send(JSON.stringify({ type: 'authenticated' }));
        } catch { socket.close(1008, 'Invalid authentication'); }
      });
      socket.on('close', () => {
        clearTimeout(authTimer);
        clearTimeout(expirationTimer);
        this.clients.delete(socket);
      });
    });
  }
  broadcast(userId: string, event: unknown) {
    const payload = JSON.stringify(event);
    for (const [socket, owner] of this.clients) {
      if (owner === userId && socket.readyState === WebSocket.OPEN) {
        if (socket.bufferedAmount > 1024 * 1024) { socket.close(1013, 'Client too slow'); continue; }
        socket.send(payload);
      }
    }
  }
  async close() {
    for (const socket of this.wss.clients) socket.terminate();
    await new Promise<void>(resolve => this.wss.close(() => resolve()));
  }
}
