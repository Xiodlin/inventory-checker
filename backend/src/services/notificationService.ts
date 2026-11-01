import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import type pg from 'pg';
import type { Config } from '../config/environment.js';
import type { Notification } from '../database/models/Notification.js';

export function pushPayload(notification: Notification) {
  return {
    notification: { title: notification.title, body: notification.body },
    data: { notificationId: notification.id },
  };
}

export class PushService {
  private readonly messaging?: Messaging;
  constructor(private readonly pool: pg.Pool, config: Config) {
    // FCM remains disabled unless explicitly enabled with an ADC credentials file.
    if (config.FIREBASE_ENABLED) this.messaging = getMessaging(initializeApp({ credential: applicationDefault() }));
  }
  async send(userId: string, notification: Notification) {
    if (!this.messaging) return;
    try {
      const tokens = await this.pool.query<{ token: string }>('SELECT token FROM device_tokens WHERE user_id=$1', [userId]);
      for (let offset = 0; offset < tokens.rows.length; offset += 500) {
        const batch = tokens.rows.slice(offset, offset + 500).map(row => row.token);
        const result = await this.messaging.sendEachForMulticast({
          tokens: batch, ...pushPayload(notification),
        });
        for (let i = 0; i < result.responses.length; i++) {
          if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(result.responses[i].error?.code ?? '')) {
            await this.pool.query('DELETE FROM device_tokens WHERE token=$1 AND user_id=$2', [batch[i], userId]);
          }
        }
      }
    } catch { console.warn('FCM notification delivery failed'); }
  }
}
