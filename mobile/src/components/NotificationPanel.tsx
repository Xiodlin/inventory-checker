import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Notification } from '../services/apiService';

export default function NotificationPanel({ notifications, onRead }: {
  notifications: Notification[]; onRead: (id: string) => void;
}) {
  return <View style={styles.panel}>
    <Text style={styles.title}>Notifications</Text>
    {!notifications.length && <Text>No notifications yet.</Text>}
    {notifications.map(notification => <Pressable key={notification.id} accessibilityRole="button"
      accessibilityLabel={`${notification.title}${notification.read ? ', read' : ', mark as read'}`}
      disabled={notification.read} onPress={() => onRead(notification.id)} style={styles.notification}>
      <Text style={{ fontWeight: notification.read ? '400' : '700' }}>{notification.title}</Text>
      <Text>{notification.body}</Text>
      <Text>{new Date(notification.created_at).toLocaleString()}{notification.read ? ' · Read' : ' · Tap to mark read'}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  panel: { gap: 10, marginVertical: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  notification: { backgroundColor: '#e8f0fa', padding: 12, borderRadius: 8, gap: 4 },
});
