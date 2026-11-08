import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Button, StatusBar, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import RootNavigator from './navigation/RootNavigator';
import { configureBackground, requestNotificationPermission } from './services/notificationService';
import { localRuntime, subscribeLocal } from './services/localRuntime';
import { SessionContext } from './session';
import { errorMessage, ui } from './ui';
import ShoppingBrowser from './components/ShoppingBrowser';
import { shoppingBrowser } from './services/shoppingBrowser';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let monitor: Awaited<ReturnType<typeof localRuntime>>['monitor'] | undefined;
    let shopping: Awaited<ReturnType<typeof localRuntime>>['shopping'] | undefined;
    const unsubscribe = subscribeLocal(() => { if (!disposed) setRevision(value => value + 1); });
    const run = () => {
      if (disposed) return;
      void localRuntime().then(async value => {
        if (disposed || AppState.currentState !== 'active') return;
        if (!shoppingBrowser.busy()) await value.shopping.tick();
        if (!disposed && AppState.currentState === 'active') await value.monitor.tick();
      }).catch(failure => {
        if (!disposed) setError(errorMessage(failure));
      });
    };
    const foreground = () => {
      clearInterval(timer);
      if (disposed) return;
      if (AppState.currentState === 'active') { run(); timer = setInterval(run, 60000); }
      else { monitor?.cancelRun(); shopping?.cancel(); shoppingBrowser.cancel(); }
    };
    const listener = AppState.addEventListener('change', foreground);
    void (async () => {
      const initialized = await localRuntime();
      const { store } = initialized;
      monitor = initialized.monitor;
      shopping = initialized.shopping;
      if (disposed) return;
      setReady(true); setError('');
      try {
        await configureBackground();
        if ((await store.settings()).notifications_enabled && !await requestNotificationPermission()) {
          setError('Device notification permission is disabled. Alerts will remain in the app.');
        }
      }
      catch (failure) { setError(errorMessage(failure)); }
      foreground();
    })().catch(failure => { if (!disposed) setError(errorMessage(failure)); });
    return () => { disposed = true; clearInterval(timer); unsubscribe(); listener.remove(); shopping?.cancel(); shoppingBrowser.cancel(); };
  }, [attempt]);
  return <SafeAreaProvider><StatusBar barStyle="dark-content" />
    <ShoppingBrowser />
    {ready ? <SessionContext.Provider value={{ revision }}><RootNavigator />
      {!!error && <SafeAreaView edges={['bottom']}><Text style={ui.error}>{error}</Text><Button title="Dismiss" onPress={() => setError('')} /></SafeAreaView>}
    </SessionContext.Provider> : <SafeAreaView style={ui.page}>
      {error ? <><Text style={ui.error}>{error}</Text><Button title="Retry opening local storage" onPress={() => { setError(''); setAttempt(value => value + 1); }} /></> : <ActivityIndicator />}
    </SafeAreaView>}
  </SafeAreaProvider>;
}
