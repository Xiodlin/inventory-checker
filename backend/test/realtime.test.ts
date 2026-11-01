import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import { WebSocket, type WebSocketServer } from 'ws';
import { Realtime } from '../src/services/websocketService.js';
import { issueToken } from '../src/api/middleware/auth.js';

test('rejected origin and query sockets handle receiver errors before closing', async () => {
  const server = createServer();
  const realtime = new Realtime(server, 'a'.repeat(64), ['null', 'file://']);
  const wss = (realtime as unknown as { wss: WebSocketServer }).wss;
  try {
    for (const request of [
      { headers: { origin: 'https://evil.example' }, url: '/ws' },
      { headers: { origin: 'file://' }, url: '/ws?token=forbidden' },
    ]) {
      const socket = new EventEmitter();
      let closed = false;
      Object.assign(socket, {
        close(code: number) {
          assert.equal(code, 1008);
          closed = true;
          // ws can emit receiver failures while CLOSING, including on rejected clients.
          assert.equal(socket.listenerCount('error'), 1);
          socket.emit('error', new Error('Invalid WebSocket frame: MASK must be set'));
        },
      });
      assert.doesNotThrow(() => wss.emit('connection', socket, request));
      assert.equal(closed, true);
    }
  } finally { await realtime.close(); }
});

test('websocket authenticates first message and scopes events to owner', async () => {
  const server = createServer();
  const secret = 'a'.repeat(64);
  const realtime = new Realtime(server, secret, ['http://localhost:5173', 'null', 'file://']);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const owner = randomUUID();
  const client = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'null' });
  try {
    await once(client, 'open');
    const ready = once(client, 'message');
    client.send(JSON.stringify({ type: 'auth', token: issueToken(owner, secret) }));
    assert.deepEqual(JSON.parse(String((await ready)[0])), { type: 'authenticated' });
    const event = once(client, 'message');
    realtime.broadcast(randomUUID(), { type: 'notification', notification: { id: 'foreign' } });
    realtime.broadcast(owner, { type: 'notification', notification: { id: 'owned' } });
    assert.equal(JSON.parse(String((await event)[0])).notification.id, 'owned');
    const rejected = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await once(rejected, 'open');
    const closed = once(rejected, 'close');
    rejected.send(JSON.stringify({ type: 'auth', token: 'invalid' }));
    assert.equal((await closed)[0], 1008);
    const foreignOrigin = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'https://evil.example' });
    assert.equal((await once(foreignOrigin, 'close'))[0], 1008);
    const fileOrigin = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'file://' });
    await once(fileOrigin, 'open');
    const fileAuth = once(fileOrigin, 'message');
    fileOrigin.send(JSON.stringify({ type: 'auth', token: issueToken(owner, secret) }));
    assert.equal(JSON.parse(String((await fileAuth)[0])).type, 'authenticated');
    fileOrigin.terminate();
  } finally {
    client.terminate();
    await realtime.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
