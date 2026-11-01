import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../api';
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
      await onSave({ notifications_enabled: enabled, check_interval_minutes: interval });
      setMessage('Preferences saved.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="panel settings">
    <span className="eyebrow">PREFERENCES</span><h2>Make it yours</h2>
    <form onSubmit={save}>
      <label className="toggle"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><div><strong>Desktop notifications</strong><small>Receive native alerts while the app is running in the tray.</small></div></label>
      <label>Check interval (minutes)<input type="number" min="5" max="10080" step="1" required value={interval} onChange={event => setInterval(Number(event.target.value))} /></label>
      <p className="muted">Minimum 5 minutes. Checks require configured backend retailer adapters.</p>
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="saved">{message}</p>}
  </section>;
}
