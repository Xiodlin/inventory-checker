import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage, localApi } from '../api';
import type { SettingsData } from '../types';
import { Button } from './Button';
import { Alert, Disclosure, Input, Checkbox } from './UI';

export default function Settings({ settings, onSave }: {
  settings: SettingsData; onSave(value: SettingsData): Promise<void>;
}) {
  const [enabled, setEnabled] = useState(settings.notifications_enabled);
  const [interval, setInterval] = useState(settings.check_interval_minutes);
  const [operation, setOperation] = useState<'save' | 'notification' | 'import' | 'export' | null>(null);
  const busy = operation !== null;
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setEnabled(settings.notifications_enabled);
    setInterval(settings.check_interval_minutes);
  }, [settings]);
  async function save(event: FormEvent) {
    event.preventDefault(); setOperation('save'); setMessage(''); setError('');
    try {
      await onSave({ ...settings, notifications_enabled: enabled, check_interval_minutes: interval });
      setMessage('Preferences saved.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setOperation(null); }
  }
  async function backup(importing: boolean) {
    setOperation(importing ? 'import' : 'export'); setError(''); setMessage('');
    try {
      const completed = importing ? await localApi().importBackup() : await localApi().exportBackup();
      if (completed) setMessage(importing ? 'Backup imported. Existing item IDs were kept unchanged.' : 'Backup exported. Keep it somewhere safe; it contains product ZIP codes.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setOperation(null); }
  }
  async function testNotification() {
    setOperation('notification'); setError(''); setMessage('');
    try {
      await localApi().testNotification();
      setMessage('The OS accepted the test notification. If no banner appeared, check notification settings and Focus / Do Not Disturb.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setOperation(null); }
  }
  return <section className="panel settings">
    <span className="eyebrow">PREFERENCES</span><h2>Make it yours</h2>
    <form className="settings-form" onSubmit={save}>
      <Checkbox label="Desktop notifications" help="Receive native alerts while the app is running in the tray." checked={enabled} onChange={event => setEnabled(event.target.checked)} />
      <Input label="Check interval (minutes)" type="number" min="5" max="10080" step="1" required value={interval} onChange={event => setInterval(Number(event.target.value))} />
      <div className="settings-actions actions">
        <Button type="submit" loading={operation === 'save'} disabled={busy}>{operation === 'save' ? 'Saving…' : 'Save preferences'}</Button>
        <Button variant="secondary" loading={operation === 'notification'} disabled={busy} onClick={() => void testNotification()}>Test desktop notification</Button>
      </div>
    </form>
    <Disclosure className="settings-details" summary="Notifications & check timing help">
      <p className="muted">Minimum 5 minutes. Checks run on this device while awake, including in the tray. After system sleep, due checks resume on wake. No server, Docker, or account is needed.</p>
      <p className="muted">On macOS, use the signed app launched by npm run dev:desktop. The first native alert may prompt for permission; if already denied, enable Inventory Checker in System Settings &gt; Notifications. Check Focus / Do Not Disturb if banners are hidden. Raw Electron development builds may fail before a permission prompt appears.</p>
      <p className="muted">The test sends one native alert even if automatic desktop notifications are turned off. It does not change your saved preferences.</p>
    </Disclosure>
    <Disclosure className="settings-details" summary="Backups & local data">
      <p className="muted">Backups include products, recent history, alerts, and pickup ZIPs—not API keys or account credentials. Import preserves existing entries with the same IDs. Device settings stay unchanged.</p>
      <div className="actions"><Button variant="secondary" loading={operation === 'export'} disabled={busy} onClick={() => void backup(false)}>Export local backup</Button>
        <Button variant="secondary" loading={operation === 'import'} disabled={busy} onClick={() => void backup(true)}>Import backup / legacy data</Button></div>
    </Disclosure>
    {error && <Alert role="alert" tone="error" title={error} />}
    {message && <Alert role="status" tone="success" title={message} />}
  </section>;
}
