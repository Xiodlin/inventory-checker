import { useState } from 'react';
import { errorMessage } from '../api';
import type { InventoryNotification } from '../types';

export default function NotificationPanel({ notifications, onRead, onClear, onDismiss, onOpen }: {
  notifications: InventoryNotification[];
  onRead(id: InventoryNotification['id']): Promise<void>;
  onClear(): Promise<void>;
  onDismiss(id: string): Promise<void>;
  onOpen(notification: InventoryNotification): Promise<void>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<InventoryNotification['id'] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  async function clear() {
    setClearing(true); setError('');
    try { await onClear(); setConfirming(false); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setClearing(false); }
  }
  async function markRead(id: InventoryNotification['id']) {
    setBusy(id); setError('');
    try { await onRead(id); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(null); }
  }
  async function act(notification: InventoryNotification, opening: boolean) {
    setBusy(notification.id); setError('');
    try { if (opening) await onOpen(notification); else await onDismiss(notification.id); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(null); }
  }
  return <section className="panel">
    <div className="section-heading"><div><span className="eyebrow">UPDATES</span><h2>Notifications</h2></div>
      <button className="danger" disabled={!notifications.length || busy !== null || clearing}
        onClick={() => { setError(''); setConfirming(true); }}>Clear notifications</button>
    </div>
    {confirming && <div role="group" aria-label="Confirm clearing notifications">
      <p className="muted">Delete all saved notifications on this device, including unread alerts and pending delivery retries? This cannot be undone. Product monitoring and future alerts stay enabled. Already displayed system notifications are not removed.</p>
      <div className="actions">
        <button className="danger" disabled={clearing || busy !== null} onClick={() => void clear()}>{clearing ? 'Clearing…' : 'Delete all notifications'}</button>
        <button disabled={clearing} onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    </div>}
    {notifications.length === 0 ? <div className="empty"><h3>You're all caught up</h3><p>Inventory and price alerts will appear here.</p></div> :
      <ul className="notifications">{notifications.map(notification => <li key={notification.id} className={notification.read ? '' : 'unread'}>
        <div><button className="notification-open" disabled={busy !== null || clearing}
          aria-label={`Open product for ${notification.title}`} onClick={() => void act(notification, true)}>
          <strong>{notification.title}</strong><p>{notification.body}</p></button><small>{new Date(notification.created_at).toLocaleString()}</small>
          {notification.delivery_error && <p role="alert">Device alert not delivered: {notification.delivery_error}</p>}
        </div>
        <div className="actions">
          {!notification.read && <button disabled={busy !== null || clearing} onClick={() => void markRead(notification.id)}>{busy === notification.id ? 'Saving…' : 'Mark read'}</button>}
          <button className="danger" aria-label={`Dismiss ${notification.title}`} disabled={busy !== null || clearing}
            onClick={() => void act(notification, false)}>Dismiss</button>
        </div>
      </li>)}</ul>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
