import { useCallback, useState } from 'react';
import { checkResultMessage } from '@inventory-checker/core';
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
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const [monitorError, setMonitorError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextItems, nextNotifications, status] = await Promise.all([apiService.items(), apiService.notifications(), apiService.status()]);
      setItems(nextItems); setNotifications(nextNotifications);
      setMonitorError(status.error ?? '');
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
    <Header title="Your inventory" subtitle="Stored on this device. Checks need internet, not a server." />
    <View style={ui.row}><Button title="Add item" onPress={() => navigation.navigate('AddItem')} />
      <Button title="Settings" onPress={() => navigation.navigate('Settings')} /></View>
    <Button title={checking ? 'Checking…' : 'Check now'} disabled={checking} onPress={() => {
      setChecking(true); setCheckMessage('');
      void apiService.check().then(async result => {
        await refresh(); setCheckMessage(checkResultMessage(result));
      }).catch(failure => setError(errorMessage(failure))).finally(() => setChecking(false));
    }} />
    {!!checkMessage && <Text accessibilityLiveRegion="polite">{checkMessage}</Text>}
    {!!error && <Text style={ui.error}>{error}</Text>}
    {!!monitorError && <Text style={ui.error}>{monitorError}</Text>}
    {loading && <ActivityIndicator />}
    {!loading && !items.length && <Text>No tracked items. Add one to get started.</Text>}
    {items.map(item => <ItemCard key={item.id} item={item} onPress={() => navigation.navigate('ItemDetails', { id: item.id })} />)}
    <NotificationPanel notifications={notifications} onRead={id => void markRead(id)} />
  </ScrollView>;
}
