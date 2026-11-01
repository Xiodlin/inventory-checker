import { PermissionsAndroid, Platform } from 'react-native';
import { apiService } from './apiService';

export interface LiveEvent {
  type: string; id?: string; title?: string; body?: string;
  notification?: { id?: string; title?: string; body?: string };
}
export function startNotifications(
  token: string,
  onEvent: (event: LiveEvent) => void,
  onError: (message: string) => void,
) {
  let stopped = false;
  let socket: WebSocket | undefined;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let deviceToken: string | undefined;
  const listeners: (() => void)[] = [];
  let deviceWork: Promise<void> = Promise.resolve();
  let stopWork: Promise<void> | undefined;
  const recentlySeen = new Map<string, number>();

  function receiveEvent(event: LiveEvent) {
    if (stopped) return;
    if (event.type === 'notification') {
      const now = Date.now();
      for (const [key, time] of recentlySeen) if (now - time > 60000) recentlySeen.delete(key);
      const key = event.id ?? JSON.stringify([event.title, event.body]);
      if (recentlySeen.has(key)) return;
      recentlySeen.set(key, now);
      if (recentlySeen.size > 256) recentlySeen.delete(recentlySeen.keys().next().value!);
    }
    onEvent(event);
  }

  function connect() {
    if (stopped) return;
    socket = new WebSocket(apiService.websocketURL());
    socket.onopen = () => socket?.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = ({ data }) => {
      if (stopped) return;
      try {
        const event = JSON.parse(String(data)) as LiveEvent;
        if (event.type === 'notification' || event.type === 'item.updated' || event.type === 'authenticated') {
          receiveEvent({ ...event, ...event.notification });
        }
      } catch { /* Ignore malformed network events. */ }
    };
    socket.onerror = () => onError('Live updates disconnected; pull to refresh still works.');
    socket.onclose = () => { if (!stopped) reconnect = setTimeout(connect, 5000); };
  }
  connect();

  const ready = (async () => {
    if (process.env.EXPO_PUBLIC_FIREBASE_ENABLED !== 'true') return;
    try {
      // Load native modules only in an explicitly configured development build.
      const { getApp } = await import('@react-native-firebase/app');
      const {
        getMessaging, requestPermission, AuthorizationStatus, getToken,
        onTokenRefresh, onMessage, onNotificationOpenedApp, getInitialNotification,
        registerDeviceForRemoteMessages,
      } = await import('@react-native-firebase/messaging');
      if (stopped) return;
      const messaging = getMessaging(getApp());
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED || stopped) return;
      }
      if (Platform.OS === 'ios') {
        const permission = await requestPermission(messaging);
        if (stopped || (permission !== AuthorizationStatus.AUTHORIZED && permission !== AuthorizationStatus.PROVISIONAL)) return;
        await registerDeviceForRemoteMessages(messaging);
      }
      const updateToken = (next: string) => {
        deviceWork = deviceWork.catch(() => {}).then(async () => {
          if (stopped) return;
          if (deviceToken && deviceToken !== next) await apiService.removeDevice(deviceToken);
          await apiService.registerDevice(next);
          deviceToken = next;
        });
        void deviceWork.catch(() => onError('Could not register push notifications.'));
      };
      if (stopped) return;
      listeners.push(onTokenRefresh(messaging, updateToken));
      const receive = (message: {
        notification?: { title?: string; body?: string };
        data?: { [key: string]: string | object };
      }) => {
        const id = typeof message.data?.notification_id === 'string' ? message.data.notification_id
          : typeof message.data?.notificationId === 'string' ? message.data.notificationId : undefined;
        receiveEvent({ type: 'notification', id, ...message.notification });
      };
      listeners.push(onMessage(messaging, receive), onNotificationOpenedApp(messaging, receive));
      const initial = await getInitialNotification(messaging);
      if (initial) receive(initial);
      if (!stopped) updateToken(await getToken(messaging));
    } catch {
      if (!stopped) onError('Push unavailable. Configure Firebase credentials and rebuild the native app.');
    }
  })();

  return {
    stop() {
      if (stopWork) return stopWork;
      stopped = true;
      clearTimeout(reconnect);
      listeners.splice(0).forEach(unsubscribe => unsubscribe());
      if (socket) { socket.onclose = null; socket.close(); }
      stopWork = (async () => {
        await ready;
        await deviceWork.catch(() => {});
        if (deviceToken) await apiService.removeDevice(deviceToken).catch(() => {});
        deviceToken = undefined;
      })();
      return stopWork;
    },
  };
}
