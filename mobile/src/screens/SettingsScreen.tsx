import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Header from '../components/Header';
import { apiService, type Settings as UserSettings } from '../services/apiService';
import { useSession } from '../session';
import { errorMessage, ui } from '../ui';

export default function SettingsScreen() {
  const { email, logout } = useSession();
  const [settings, setSettings] = useState<UserSettings>();
  const [interval, setInterval] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    void apiService.settings().then(value => { setSettings(value); setInterval(String(value.check_interval_minutes)); })
      .catch(cause => setError(errorMessage(cause)));
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
      setSettings(next); setMessage('Settings saved.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <ScrollView style={ui.page} contentContainerStyle={ui.content}>
    <Header title="Settings" subtitle={email} />
    <Text>API server: {apiService.getBaseURL()}</Text>
    <Text>Change the server on the sign-in screen after signing out.</Text>
    {!settings && !error && <ActivityIndicator />}
    {settings && <>
      <View style={ui.row}><Text style={ui.label}>Notifications</Text>
        <Switch accessibilityLabel="Notifications enabled" value={settings.notifications_enabled}
          disabled={busy} onValueChange={value => setSettings({ ...settings, notifications_enabled: value })} /></View>
      <Text style={ui.label}>Check interval (minutes, minimum 5)</Text>
      <TextInput accessibilityLabel="Check interval in minutes" style={ui.input} value={interval}
        onChangeText={setInterval} keyboardType="number-pad" editable={!busy} />
      <Button title={busy ? 'Saving…' : 'Save settings'} disabled={busy} onPress={() => void save()} />
    </>}
    {!!error && <Text style={ui.error}>{error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    <Text>Push notifications require an opted-in Firebase native build. Foreground live updates work without Firebase.</Text>
    <Button title="Sign out" disabled={busy} onPress={() => { setBusy(true); void logout(); }} />
  </ScrollView>;
}
