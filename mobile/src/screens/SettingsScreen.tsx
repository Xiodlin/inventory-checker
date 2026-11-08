import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Modal, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { apiService, type Settings as UserSettings } from '../services/apiService';
import { configureBackground, requestNotificationPermission } from '../services/notificationService';
import { getKey, saveKey } from '../services/localRuntime';
import { exportBackup, importBackup } from '../services/backupService';
import { errorMessage, ui } from '../ui';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>();
  const [interval, setInterval] = useState('');
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [keyHelpVisible, setKeyHelpVisible] = useState(false);
  const [background, setBackground] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    void (async () => {
      const value = await apiService.settings();
      setSettings(value); setInterval(String(value.check_interval_minutes));
      setHasKey(Boolean(await getKey())); setBackground(await configureBackground());
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
      if (key) { await saveKey(key); setKey(''); setHasKey(true); }
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
      <Text>Background requests use a minimum of 15 minutes, but iOS/Android choose when to run. Locked screens may allow checks; low power, Background App Refresh restrictions, or force-quitting may stop them. No timely sleep alerts are guaranteed. A native build is required.</Text>
      <Text>{background}</Text>
      <Text style={ui.label}>Best Buy API key</Text>
      <TextInput accessibilityLabel="Best Buy API key" style={ui.input} value={key} onChangeText={setKey} secureTextEntry
        maxLength={1000} autoCapitalize="none" autoCorrect={false} editable={!busy}
        placeholder={hasKey ? 'Stored securely; leave blank to keep' : 'Required for Best Buy checks'} />
      <Button title="How to get a key" onPress={() => setKeyHelpVisible(true)} />
      <Text>Keys use device secure storage. ZIP codes are saved per product and sent only to Apple when checking pickup.</Text>
      {hasKey && <Button title="Remove Best Buy key" disabled={busy} onPress={() => {
        void saveKey('').then(() => setHasKey(false)).catch(failure => setError(errorMessage(failure)));
      }} />}
      <Button title={busy ? 'Saving…' : 'Save settings and enable notifications'} disabled={busy} onPress={() => void save()} />
    </>}
    <Modal visible={keyHelpVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setKeyHelpVisible(false)}>
      <SafeAreaView style={ui.page}>
        <ScrollView contentContainerStyle={ui.content}>
          <Text accessibilityRole="header" style={ui.label}>How to get a Best Buy API key</Text>
          <Text selectable>1. Open https://developer.bestbuy.com/ in your browser and choose Get API Key.</Text>
          <Text>2. Sign in to or create a Best Buy account, then follow the developer registration prompts and review the API terms.</Text>
          <Text>3. Copy the API key issued by the developer portal, close this window, paste it into the Best Buy API key field, and select Save settings and enable notifications.</Text>
          <Text>Use the API key, not your Best Buy password. Keep it private. If the portal does not issue a key, contact Best Buy developer support; Best Buy checks require authorized API access. Amazon, Target, and Apple checks do not require API keys.</Text>
          <Button title="Close" onPress={() => setKeyHelpVisible(false)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
    {!!error && <Text style={ui.error}>{error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    <Text>Data is independent on each device. Uninstalling the app or clearing its data can remove your watchlist and history.</Text>
    <Text>Backups include products, recent history, alerts, and pickup ZIPs—not credentials or API keys. Save to a local file using the export sheet. Import leaves device settings and existing item IDs unchanged.</Text>
    <Button title="Export local backup" disabled={busy} onPress={() => void backup(false)} />
    <Button title="Import backup / legacy data" disabled={busy} onPress={() => void backup(true)} />
  </ScrollView>;
}
