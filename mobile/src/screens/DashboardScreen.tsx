import { useCallback, useState } from 'react';
import { ActivityIndicator, Button, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import Header from '../components/Header';
import ItemCard from '../components/ItemCard';
import NotificationPanel from '../components/NotificationPanel';
import { apiService, type Item, type Notification } from '../services/apiService';
import { useSession } from '../session';
import { errorMessage, ui } from '../ui';

export default function DashboardScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Dashboard'>) {
  const { revision } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextItems, nextNotifications] = await Promise.all([apiService.items(), apiService.notifications()]);
      setItems(nextItems); setNotifications(nextNotifications);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh, revision]));
  const markRead = async (id: string) => {
    try { await apiService.markRead(id); setNotifications(current => current.map(n => n.id === id ? { ...n, read: true } : n)); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  return <ScrollView style={ui.page} contentContainerStyle={ui.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
    <Header title="Your inventory" subtitle="Track stock and prices across your retailers." />
    <View style={ui.row}><Button title="Add item" onPress={() => navigation.navigate('AddItem')} />
      <Button title="Settings" onPress={() => navigation.navigate('Settings')} /></View>
    {!!error && <Text style={ui.error}>{error}</Text>}
    {loading && <ActivityIndicator />}
    {!loading && !items.length && <Text>No tracked items. Add one to get started.</Text>}
    {items.map(item => <ItemCard key={item.id} item={item} onPress={() => navigation.navigate('ItemDetails', { id: item.id })} />)}
    <NotificationPanel notifications={notifications} onRead={id => void markRead(id)} />
  </ScrollView>;
}
