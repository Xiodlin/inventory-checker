import { useState } from 'react';
import { errorMessage } from '../api';
import type { InventoryNotification } from '../types';
import { Button } from './Button';
import { Alert, EmptyState } from './UI';

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
      <Button variant="danger" disabled={!notifications.length || busy !== null || clearing}
        onClick={() => { setError(''); setConfirming(true); }}>Clear notifications</Button>
    </div>
    {confirming && <div role="group" aria-label="Confirm clearing notifications">
      <p className="muted">Delete all saved notifications on this device, including unread alerts and pending delivery retries? This cannot be undone. Product monitoring and future alerts stay enabled. Already displayed system notifications are not removed.</p>
      <div className="actions">
        <Button variant="danger" loading={clearing} disabled={busy !== null} onClick={() => void clear()}>{clearing ? 'Clearing…' : 'Delete all notifications'}</Button>
        <Button variant="secondary" disabled={clearing} onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    </div>}
    {notifications.length === 0 ? <EmptyState title="You're all caught up">Inventory and price alerts will appear here.</EmptyState> :
      <ul className="notifications">{notifications.map(notification => <li key={notification.id} className={notification.read ? '' : 'unread'}>
        <div><Button variant="ghost" className="notification-open" disabled={busy !== null || clearing}
          aria-label={`Open product for ${notification.title}`} onClick={() => void act(notification, true)}>
          <strong>{notification.title}</strong><span className="notification-body">{notification.body}</span></Button><small>{new Date(notification.created_at).toLocaleString()}</small>
          {notification.delivery_error && <Alert role="alert" tone="warning" title={`Device alert not delivered: ${notification.delivery_error}`} />}
        </div>
        <div className="actions">
          {!notification.read && <Button variant="secondary" disabled={busy !== null || clearing} onClick={() => void markRead(notification.id)}>{busy === notification.id ? 'Saving…' : 'Mark read'}</Button>}
          <Button variant="danger" aria-label={`Dismiss ${notification.title}`} disabled={busy !== null || clearing}
            onClick={() => void act(notification, false)}>Dismiss</Button>
        </div>
      </li>)}</ul>}
    {error && <Alert role="alert" tone="error" title={error} />}
  </section>;
}
