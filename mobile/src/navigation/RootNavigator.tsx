import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { notificationTarget, type NotificationTarget } from '@inventory-checker/core';
import { apiService } from '../services/apiService';
import { errorMessage } from '../ui';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Dashboard from '../screens/DashboardScreen';
import ItemDetails from '../screens/ItemDetailsScreen';
import Settings from '../screens/SettingsScreen';

export type RootStackParamList = {
  Dashboard: { target: NotificationTarget | null; request: number } | undefined; ItemDetails: { id: string }; Settings: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();
const navigation = createNavigationContainerRef<RootStackParamList>();
export default function RootNavigator() {
  const pending = useRef<Notifications.NotificationResponse | null>(null);
  const handled = useRef<string | null>(null);
  const open = async (response: Notifications.NotificationResponse) => {
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handled.current === key) return;
    if (!navigation.isReady()) { pending.current = response; return; }
    handled.current = key;
    const data = response.notification.request.content.data ?? {};
    try {
      if (typeof data.notificationId === 'string'
        && (await apiService.notifications()).some(alert => alert.id === data.notificationId)) {
        await apiService.markRead(data.notificationId);
      }
      await Notifications.clearLastNotificationResponseAsync();
    } catch (failure) { Alert.alert('Could not update notification', errorMessage(failure)); }
    navigation.navigate('Dashboard', { target: notificationTarget(data.target), request: Date.now() });
  };
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => { void open(response); });
    void Notifications.getLastNotificationResponseAsync().then(response => { if (response) return open(response); })
      .catch(failure => Alert.alert('Could not open notification', errorMessage(failure)));
    return () => subscription.remove();
  }, []);
  return <NavigationContainer ref={navigation} onReady={() => {
    const response = pending.current; pending.current = null;
    if (response) void open(response);
  }}><Stack.Navigator>
    <Stack.Screen name="Dashboard" component={Dashboard} options={{ title: 'Inventory Checker' }} />
    <Stack.Screen name="ItemDetails" component={ItemDetails} options={{ title: 'Item details' }} />
    <Stack.Screen name="Settings" component={Settings} />
  </Stack.Navigator></NavigationContainer>;
}
