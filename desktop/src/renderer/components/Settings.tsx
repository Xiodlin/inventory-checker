import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage, localApi } from '../api';
import type { SettingsData } from '../types';

export default function Settings({ settings, onSave }: {
  settings: SettingsData; onSave(value: SettingsData): Promise<void>;
}) {
  const [enabled, setEnabled] = useState(settings.notifications_enabled);
  const [interval, setInterval] = useState(settings.check_interval_minutes);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setEnabled(settings.notifications_enabled);
    setInterval(settings.check_interval_minutes);
  }, [settings]);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      await onSave({ ...settings, notifications_enabled: enabled, check_interval_minutes: interval });
      setMessage('Preferences saved.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function backup(importing: boolean) {
    setBusy(true); setError(''); setMessage('');
    try {
      const completed = importing ? await localApi().importBackup() : await localApi().exportBackup();
      if (completed) setMessage(importing ? 'Backup imported. Existing item IDs were kept unchanged.' : 'Backup exported. Keep it somewhere safe; it contains product ZIP codes.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function testNotification() {
    setBusy(true); setError(''); setMessage('');
    try {
      await localApi().testNotification();
      setMessage('The OS accepted the test notification. If no banner appeared, check notification settings and Focus / Do Not Disturb.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="panel settings">
    <span className="eyebrow">PREFERENCES</span><h2>Make it yours</h2>
    <form className="settings-form" onSubmit={save}>
      <label className="toggle"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><div><strong>Desktop notifications</strong><small>Receive native alerts while the app is running in the tray.</small></div></label>
      <label>Check interval (minutes)<input type="number" min="5" max="10080" step="1" required value={interval} onChange={event => setInterval(Number(event.target.value))} /></label>
      <div className="settings-actions actions">
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
        <button type="button" disabled={busy} onClick={() => void testNotification()}>Test desktop notification</button>
      </div>
    </form>
    <details className="settings-details">
      <summary>Notifications &amp; check timing help</summary>
      <p className="muted">Minimum 5 minutes. Checks run on this device while awake, including in the tray. After system sleep, due checks resume on wake. No server, Docker, or account is needed.</p>
      <p className="muted">On macOS, use the signed app launched by npm run dev:desktop. The first native alert may prompt for permission; if already denied, enable Inventory Checker in System Settings &gt; Notifications. Check Focus / Do Not Disturb if banners are hidden. Raw Electron development builds may fail before a permission prompt appears.</p>
      <p className="muted">The test sends one native alert even if automatic desktop notifications are turned off. It does not change your saved preferences.</p>
    </details>
    <details className="settings-details">
      <summary>Backups &amp; local data</summary>
      <p className="muted">Backups include products, recent history, alerts, and pickup ZIPs—not API keys or account credentials. Import preserves existing entries with the same IDs. Device settings stay unchanged.</p>
      <div className="actions"><button disabled={busy} onClick={() => void backup(false)}>Export local backup</button>
        <button disabled={busy} onClick={() => void backup(true)}>Import backup / legacy data</button></div>
    </details>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="saved">{message}</p>}
  </section>;
}
