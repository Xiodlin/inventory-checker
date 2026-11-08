import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const keyHelp = useRef<HTMLDialogElement>(null);
  useEffect(() => { void localApi().hasKey().then(setHasKey).catch(failure => setError(errorMessage(failure))); }, []);
  useEffect(() => {
    setEnabled(settings.notifications_enabled);
    setInterval(settings.check_interval_minutes);
  }, [settings]);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      if (key) { await localApi().saveKey(key); setKey(''); setHasKey(true); }
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
    <form onSubmit={save}>
      <label className="toggle"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><div><strong>Desktop notifications</strong><small>Receive native alerts while the app is running in the tray.</small></div></label>
      <p className="muted">On macOS, use the signed app launched by npm run dev:desktop. The first native alert may prompt for permission; if already denied, enable Inventory Checker in System Settings &gt; Notifications. Check Focus / Do Not Disturb if banners are hidden. Raw Electron development builds may fail before a permission prompt appears.</p>
      <button type="button" disabled={busy} onClick={() => void testNotification()}>{busy ? 'Working…' : 'Test desktop notification'}</button>
      <p className="muted">The test sends one native alert even if automatic desktop notifications are turned off. It does not change your saved preferences.</p>
      <label>Check interval (minutes)<input type="number" min="5" max="10080" step="1" required value={interval} onChange={event => setInterval(Number(event.target.value))} /></label>
      <p className="muted">Minimum 5 minutes. Checks run on this device while awake, including in the tray. After system sleep, due checks resume on wake. No server, Docker, or account is needed.</p>
      <label>Best Buy API key<input type="password" value={key} maxLength={1000} onChange={event => setKey(event.target.value)} placeholder={hasKey ? 'A key is stored securely; leave blank to keep it' : 'Required for Best Buy checks'} autoComplete="off" /></label>
      <button type="button" aria-haspopup="dialog" onClick={() => keyHelp.current?.showModal()}>How to get a key</button>
      <p className="muted">The key is encrypted using your OS credential protection. Retailer requests use it; your watchlist remains local.</p>
      {hasKey && <button type="button" disabled={busy} onClick={() => {
        void localApi().saveKey('').then(() => setHasKey(false)).catch(failure => setError(errorMessage(failure)));
      }}>Remove Best Buy key</button>}
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
    </form>
    <dialog ref={keyHelp} className="key-help" aria-labelledby="key-help-title">
      <h2 id="key-help-title">How to get a Best Buy API key</h2>
      <ol className="muted">
        <li>Open <code>https://developer.bestbuy.com/</code> in your browser and choose Get API Key.</li>
        <li>Sign in to or create a Best Buy account, then follow the developer registration prompts and review the API terms.</li>
        <li>Copy the API key issued by the developer portal, close this window, paste it into the Best Buy API key field, and select Save preferences.</li>
      </ol>
      <p className="muted">Use the API key, not your Best Buy password. Keep it private. If the portal does not issue a key, contact Best Buy developer support; Best Buy checks require authorized API access. Amazon, Target, and Apple checks do not require API keys.</p>
      <button type="button" autoFocus onClick={() => keyHelp.current?.close()}>Close</button>
    </dialog>
    <p className="muted">Backups include products, recent history, alerts, and pickup ZIPs—not API keys or account credentials. Import preserves existing entries with the same IDs. Device settings stay unchanged.</p>
    <div className="actions"><button disabled={busy} onClick={() => void backup(false)}>Export local backup</button>
      <button disabled={busy} onClick={() => void backup(true)}>Import backup / legacy data</button></div>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="saved">{message}</p>}
  </section>;
}
