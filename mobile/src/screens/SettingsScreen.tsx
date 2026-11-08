import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Header from '../components/Header';
import CollapsibleSection from '../components/CollapsibleSection';
import { apiService, type Settings as UserSettings } from '../services/apiService';
import { configureBackground, requestNotificationPermission } from '../services/notificationService';
import { exportBackup, importBackup } from '../services/backupService';
import { errorMessage, ui } from '../ui';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>();
  const [interval, setInterval] = useState('');
  const [background, setBackground] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    void (async () => {
      const value = await apiService.settings();
      setSettings(value); setInterval(String(value.check_interval_minutes));
      setBackground(await configureBackground());
    })().catch(failure => setError(errorMessage(failure)));
  }, []);
  const save = async () => {
    if (!settings) return;
    const minutes = Number(interval);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 10080) {
      setError('Check interval must be a whole number between 5 and 10,080 minutes.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await apiService.saveSettings({ ...settings, check_interval_minutes: minutes });
      setSettings(next); setBackground(await configureBackground());
      if (next.notifications_enabled && !await requestNotificationPermission()) {
        setMessage('Settings saved. Notification permission is denied; alerts remain available in the app.');
      } else setMessage('Settings saved on this device.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  const backup = async (importing: boolean) => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (importing) {
        if (await importBackup()) setMessage('Backup imported. Existing item IDs were kept unchanged.');
      } else await exportBackup();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <ScrollView style={ui.page} contentContainerStyle={ui.content}>
    <Header title="Settings" subtitle="Stored on this device. No account, server, or Docker required." />
    {!settings && !error && <ActivityIndicator />}
    {settings && <>
      <View style={ui.row}><Text style={ui.label}>Local notifications</Text>
        <Switch accessibilityLabel="Notifications enabled" value={settings.notifications_enabled} disabled={busy}
          onValueChange={value => setSettings({ ...settings, notifications_enabled: value })} /></View>
      <View style={ui.row}><Text style={ui.label}>Best-effort background checks</Text>
        <Switch accessibilityLabel="Background checks enabled" value={settings.background_enabled} disabled={busy}
          onValueChange={value => setSettings({ ...settings, background_enabled: value })} /></View>
      <Text style={ui.label}>Foreground check interval (minutes, minimum 5)</Text>
      <TextInput accessibilityLabel="Check interval in minutes" style={ui.input} value={interval} onChangeText={setInterval} keyboardType="number-pad" editable={!busy} />
      <Button title={busy ? 'Saving…' : 'Save settings'} disabled={busy} onPress={() => void save()} />
      <CollapsibleSection title="Notifications & check timing help">
        <Text>Google searches check while the app is open and active. Existing retailer background requests use a minimum of 15 minutes, but iOS/Android choose when to run. Locked screens may allow checks; low power, Background App Refresh restrictions, or force-quitting may stop them. No timely sleep alerts are guaranteed. A native build is required.</Text>
        <Text>{background}</Text>
        <Text>Saving with notifications enabled requests device permission. If denied, alerts remain available in the app.</Text>
      </CollapsibleSection>
    </>}
    {!!error && <Text style={ui.error}>{error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    <CollapsibleSection title="Backups & local data">
      <Text>Data is independent on each device. Uninstalling the app or clearing its data can remove your watchlist and history. ZIP codes are saved per product and sent only to Apple when checking pickup.</Text>
      <Text>Backups include products, recent history, alerts, and pickup ZIPs—not credentials or API keys. Save to a local file using the export sheet. Import leaves device settings and existing item IDs unchanged.</Text>
      <Button title="Export local backup" disabled={busy} onPress={() => void backup(false)} />
      <Button title="Import backup / legacy data" disabled={busy} onPress={() => void backup(true)} />
    </CollapsibleSection>
  </ScrollView>;
}
