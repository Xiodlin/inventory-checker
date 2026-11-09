import { useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Notification } from '../services/apiService';
import { errorMessage, ui } from '../ui';

export default function NotificationPanel({ notifications, onRead, onClear, onDismiss, onOpen }: {
  notifications: Notification[]; onRead: (id: string) => void;
  onClear: () => Promise<void>;
  onDismiss: (id: string) => Promise<void>; onOpen: (notification: Notification) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function clear() {
    setBusy(true); setError('');
    try { await onClear(); setConfirming(false); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function act(notification: Notification, opening: boolean) {
    setBusy(true); setError('');
    try { if (opening) await onOpen(notification); else await onDismiss(notification.id); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <View style={styles.panel}>
    <Text style={styles.title}>Notifications</Text>
    <Button title="Clear notifications" disabled={!notifications.length || busy}
      onPress={() => { setError(''); setConfirming(true); }} />
    {confirming && <View style={{ gap: 10 }}>
      <Text>Delete all saved notifications on this device, including unread alerts and pending delivery retries? This cannot be undone. Monitoring and future alerts stay enabled. Already displayed system notifications are not removed.</Text>
      <Button title={busy ? 'Clearing…' : 'Delete all notifications'} disabled={busy} onPress={() => void clear()} />
      <Button title="Cancel" disabled={busy} onPress={() => setConfirming(false)} />
    </View>}
    {!!error && <Text style={ui.error} accessibilityRole="alert">{error}</Text>}
    {!notifications.length && <Text>No notifications yet.</Text>}
    {notifications.map(notification => <View key={notification.id} style={styles.notification}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open product for ${notification.title}`}
        disabled={busy} onPress={() => void act(notification, true)}>
      <Text style={{ fontWeight: notification.read ? '400' : '700' }}>{notification.title}</Text>
      <Text>{notification.body}</Text>
      {!!notification.delivery_error && <Text accessibilityRole="alert">Device alert not delivered: {notification.delivery_error}</Text>}
      <Text>{new Date(notification.created_at).toLocaleString()}{notification.read ? ' · Read' : ' · Tap to open product'}</Text>
      </Pressable>
      {!notification.read && <Button title="Mark read" disabled={busy} onPress={() => onRead(notification.id)} />}
      <Button title="Dismiss" accessibilityLabel={`Dismiss ${notification.title}`} disabled={busy} onPress={() => void act(notification, false)} />
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  panel: { gap: 10, marginVertical: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  notification: { backgroundColor: '#e8f0fa', padding: 12, borderRadius: 8, gap: 4 },
});
