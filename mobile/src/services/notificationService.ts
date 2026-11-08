import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { localRuntime } from './localRuntime';

export const backgroundTaskName = 'inventory-checker-local-checks';
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});
TaskManager.defineTask(backgroundTaskName, async ({ error }) => {
  try {
    const { monitor } = await localRuntime();
    if (error) throw new Error(error.message);
    const expiration = BackgroundTask.addExpirationListener(() => monitor.cancelRun());
    try { await monitor.tick({ background: true, limit: 2, budgetMs: 45000 }); }
    finally { expiration.remove(); }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : 'Background inventory check failed';
    console.warn('Background inventory check failed:', message);
    try { await (await localRuntime()).store.reportError(message); }
    catch (storageError) { console.error('Could not save background failure:', storageError); }
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function configureBackground(): Promise<string> {
  const { store } = await localRuntime();
  const settings = await store.settings();
  const available = await TaskManager.isAvailableAsync();
  if (!settings.background_enabled) {
    if (available && await TaskManager.isTaskRegisteredAsync(backgroundTaskName)) {
      await BackgroundTask.unregisterTaskAsync(backgroundTaskName);
    }
    return 'Background checks disabled.';
  }
  if (!available || await BackgroundTask.getStatusAsync() !== BackgroundTask.BackgroundTaskStatus.Available) {
    return 'Background checks unavailable. Use a native build on a supported physical device and enable Background App Refresh.';
  }
  await BackgroundTask.registerTaskAsync(backgroundTaskName, { minimumInterval: Math.max(15, settings.check_interval_minutes) });
  return 'Background checks requested. The OS decides when they run; no fixed interval or timely alert is guaranteed.';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('inventory', { name: 'Inventory alerts', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const result = await Notifications.requestPermissionsAsync();
  return result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}
