import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Header from './components/Header';
import RootNavigator from './navigation/RootNavigator';
import { apiService, type AuthResult } from './services/apiService';
import { startNotifications } from './services/notificationService';
import { storageService } from './services/storageService';
import { SessionContext } from './session';
import { errorMessage, ui } from './ui';

export default function App() {
  const [session, setSession] = useState<AuthResult | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [baseURL, setBaseURL] = useState(apiService.getBaseURL());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [liveMessage, setLiveMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const notifications = useRef<ReturnType<typeof startNotifications> | null>(null);
  const loggingOut = useRef(false);
  useEffect(() => {
    if (!liveMessage) return;
    const timeout = setTimeout(() => setLiveMessage(''), 8000);
    return () => clearTimeout(timeout);
  }, [liveMessage]);
  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    try { await notifications.current?.stop(); }
    finally {
      notifications.current = null;
      apiService.setToken(null);
      setSession(null); setPassword(''); setLiveMessage(''); setBusy(false);
      loggingOut.current = false;
    }
  }, []);
  useEffect(() => {
    void storageService.getBaseURL().then(value => {
      if (value) { apiService.setBaseURL(value); setBaseURL(value); }
    }).catch(cause => setError(errorMessage(cause))).finally(() => setReady(true));
    return apiService.onUnauthorized(() => { setError('Your session expired. Please sign in again.'); void logout(); });
  }, [logout]);
  useEffect(() => {
    if (!session) return;
    const service = startNotifications(session.token, event => {
      setRevision(value => value + 1);
      if (event.type === 'notification') setLiveMessage([event.title, event.body].filter(Boolean).join(' — ') || 'New notification received.');
    }, setLiveMessage);
    notifications.current = service;
    return () => { void service.stop(); };
  }, [session]);
  const authenticate = async () => {
    setBusy(true); setError('');
    try {
      apiService.setBaseURL(baseURL);
      if (!email.trim() || !password) throw new Error('Email and password are required.');
      if (password.length < 8 || password.length > 128) throw new Error('Password must contain 8–128 characters.');
      await storageService.setBaseURL(apiService.getBaseURL());
      const result = await apiService.authenticate(mode, email.trim(), password);
      apiService.setToken(result.token); setSession(result); setPassword('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <SafeAreaProvider><StatusBar barStyle="dark-content" />
    {!ready ? <SafeAreaView style={ui.page}><ActivityIndicator /></SafeAreaView> : session ?
      <SessionContext.Provider value={{ email: session.user.email, revision, logout }}>
        <RootNavigator />
        {!!liveMessage && <SafeAreaView edges={['top']} pointerEvents="box-none"
          style={{ position: 'absolute', top: 0, left: 16, right: 16, zIndex: 100, elevation: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${liveMessage}. Dismiss notification`}
            onPress={() => setLiveMessage('')} style={{ padding: 16, borderRadius: 12, backgroundColor: '#16324f', marginTop: 8 }}>
            <Text accessibilityLiveRegion="assertive" style={{ color: '#fff', fontWeight: '600' }}>{liveMessage}</Text>
            <Text style={{ color: '#d8e9fb', marginTop: 4 }}>Tap to dismiss</Text>
          </Pressable>
        </SafeAreaView>}
      </SessionContext.Provider> :
      <SafeAreaView style={ui.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
          <Header title="Inventory Checker" subtitle="Sign in to track products, stock, and price alerts." />
          <Text style={ui.label}>API server</Text>
          <TextInput style={ui.input} accessibilityLabel="API server" value={baseURL} onChangeText={setBaseURL}
            autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy} />
          <Text>For a physical device use your computer's LAN address; Android emulator uses 10.0.2.2.</Text>
          <Text style={ui.label}>Email</Text>
          <TextInput style={ui.input} accessibilityLabel="Email" value={email} onChangeText={setEmail}
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} />
          <Text style={ui.label}>Password</Text>
          <TextInput style={ui.input} accessibilityLabel="Password" value={password} onChangeText={setPassword}
            secureTextEntry autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} editable={!busy} />
          {!!error && <Text style={ui.error}>{error}</Text>}
          <Button title={busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            disabled={busy} onPress={() => void authenticate()} />
          <View><Button title={mode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}
            disabled={busy} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} /></View>
        </ScrollView>
      </KeyboardAvoidingView></SafeAreaView>}
  </SafeAreaProvider>;
}
