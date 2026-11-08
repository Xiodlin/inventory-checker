import { useState } from 'react';
import { errorMessage } from '../api';
import type { InventoryNotification } from '../types';

export default function NotificationPanel({ notifications, onRead }: {
  notifications: InventoryNotification[];
  onRead(id: InventoryNotification['id']): Promise<void>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<InventoryNotification['id'] | null>(null);
  async function markRead(id: InventoryNotification['id']) {
    setBusy(id); setError('');
    try { await onRead(id); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(null); }
  }
  return <section className="panel">
    <span className="eyebrow">UPDATES</span><h2>Notifications</h2>
    {notifications.length === 0 ? <div className="empty"><h3>You're all caught up</h3><p>Inventory and price alerts will appear here.</p></div> :
      <ul className="notifications">{notifications.map(notification => <li key={notification.id} className={notification.read ? '' : 'unread'}>
        <div><strong>{notification.title}</strong><p>{notification.body}</p><small>{new Date(notification.created_at).toLocaleString()}</small>
          {notification.delivery_error && <p role="alert">Device alert not delivered: {notification.delivery_error}</p>}
        </div>
        {!notification.read && <button disabled={busy === notification.id} onClick={() => void markRead(notification.id)}>{busy === notification.id ? 'Saving…' : 'Mark read'}</button>}
      </li>)}</ul>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
