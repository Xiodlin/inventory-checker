import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pushPayload } from '../src/services/notificationService.js';

test('FCM data shares the persisted notification ID for WebSocket deduplication', () => {
  const id = randomUUID();
  const notification = { id, title: 'Tracked item available', body: 'Back in stock', read: false, created_at: new Date().toISOString() };
  assert.deepEqual(pushPayload(notification), {
    notification: { title: notification.title, body: notification.body },
    data: { notificationId: id },
  });
  assert.equal(typeof pushPayload(notification).data.notificationId, 'string');
});
