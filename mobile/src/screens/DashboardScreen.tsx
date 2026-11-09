import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { checkResultMessage, type NotificationTarget } from '@inventory-checker/core';
import { ActivityIndicator, Button, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import Header from '../components/Header';
import ItemCard from '../components/ItemCard';
import NotificationPanel from '../components/NotificationPanel';
import ShoppingDiscovery from '../components/ShoppingDiscovery';
import CollapsibleSection from '../components/CollapsibleSection';
import NotificationCardFocus, { type ProductView } from '../components/NotificationCardFocus';
import { apiService, type Item, type Notification } from '../services/apiService';
import { useSession } from '../session';
import { errorMessage, ui } from '../ui';
import { localRuntime } from '../services/localRuntime';

export default function DashboardScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Dashboard'>) {
  const { revision } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const [monitorError, setMonitorError] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const content = useRef<ProductView>(null);
  const [focus, setFocus] = useState<{ target: NotificationTarget; request: number } | null>(null);
  const [navigationMessage, setNavigationMessage] = useState('');
  const reveal = useCallback((view: ProductView) => {
    if (!content.current) return;
    view.measureLayout(content.current, (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }),
      () => setError('Could not scroll to the linked product. It is highlighted on the dashboard.'));
  }, []);
  useEffect(() => {
    if (!route.params) return;
    const { target, request } = route.params;
    let active = true;
    setFocus(null);
    if (!target) { setNavigationMessage('This older notification has no product link.'); return; }
    void (async () => {
      const exists = target.kind === 'item' ? (await apiService.items()).some(item => item.id === target.id)
        : (await (await localRuntime()).shopping.watches()).some(watch => watch.id === target.id);
      if (!active) return;
      setNavigationMessage(exists ? '' : 'The product linked to this notification has been removed.');
      if (exists) setFocus({ target, request });
    })().catch(failure => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [route.params]);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextItems, nextNotifications, status] = await Promise.all([apiService.items(), apiService.notifications(), apiService.status()]);
      setItems(nextItems); setNotifications(nextNotifications);
      setMonitorError(status.error ?? '');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh, revision, route.params]));
  const markRead = async (id: string) => {
    try { await apiService.markRead(id); setNotifications(current => current.map(n => n.id === id ? { ...n, read: true } : n)); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  const clearNotifications = async () => {
    await apiService.clearNotifications();
    setNotifications(await apiService.notifications());
  };
  const dismissNotification = async (id: string) => {
    await apiService.deleteNotification(id);
    setNotifications(await apiService.notifications());
  };
  const openNotification = async (alert: Notification) => {
    if (!alert.read) await apiService.markRead(alert.id);
    setNotifications(current => current.map(value => value.id === alert.id ? { ...value, read: true } : value));
    navigation.navigate('Dashboard', { target: alert.target ?? null, request: Date.now() });
  };
  return <ScrollView ref={scroll} style={ui.page} contentContainerStyle={ui.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
    <View ref={content} collapsable={false} style={{ gap: 12 }}>
    <Header title="Your watchlist" subtitle="Stored on this device. Checks need internet, not a server." />
    <Button title="Settings" onPress={() => navigation.navigate('Settings')} />
    <Button title={checking ? 'Checking…' : 'Check now'} disabled={checking} onPress={() => {
      setChecking(true); setCheckMessage('');
      void apiService.check().then(async result => {
        await refresh();
        const searches = await (await localRuntime()).shopping.watches();
        setCheckMessage(searches.length
          ? `Search checks finished. ${searches.filter(watch => watch.error).length} searches have errors; review watchlist details. ${checkResultMessage(result)}`
          : checkResultMessage(result));
      }).catch(failure => setError(errorMessage(failure))).finally(() => setChecking(false));
    }} />
    {!!checkMessage && <Text accessibilityLiveRegion="polite">{checkMessage}</Text>}
    {!!error && <Text style={ui.error}>{error}</Text>}
    {!!navigationMessage && <Text accessibilityLiveRegion="polite">{navigationMessage}</Text>}
    {!!monitorError && <Text style={ui.error}>{monitorError}</Text>}
    {loading && <ActivityIndicator />}
    <ShoppingDiscovery focus={focus} onReveal={reveal} existingCount={items.length} existingProducts={items.map(item =>
      <NotificationCardFocus key={item.id} active={focus?.target.kind === 'item' && focus.target.id === item.id}
        request={focus?.request} onReveal={reveal}>
        <ItemCard item={item} onPress={() => navigation.navigate('ItemDetails', { id: item.id })} />
      </NotificationCardFocus>)} />
    <CollapsibleSection title={`Notifications (${notifications.filter(value => !value.read).length} unread)`}>
      <NotificationPanel notifications={notifications} onRead={id => void markRead(id)} onClear={clearNotifications}
        onDismiss={dismissNotification} onOpen={openNotification} />
    </CollapsibleSection>
    </View>
  </ScrollView>;
}
