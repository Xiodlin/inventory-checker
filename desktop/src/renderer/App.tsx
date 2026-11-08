import { useCallback, useEffect, useState } from 'react';
import { checkResultMessage } from '@inventory-checker/core/dist/types';
import { errorMessage, localApi } from './api';
import Dashboard from './components/Dashboard';
import NotificationPanel from './components/NotificationPanel';
import Settings from './components/Settings';
import ShoppingDiscovery from './components/ShoppingDiscovery';
import type { InventoryNotification, Item, SettingsData, ShoppingWatch } from './types';
import appIcon from '../../public/assets/icon.png';

type Page = 'dashboard' | 'notifications' | 'settings';
export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [watches, setWatches] = useState<ShoppingWatch[]>([]);
  const [notifications, setNotifications] = useState<InventoryNotification[]>([]);
  const [settings, setSettings] = useState<SettingsData>();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const [error, setError] = useState('');
  const [monitorError, setMonitorError] = useState('');
  const [lastRun, setLastRun] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const api = localApi();
      const [nextItems, alerts, preferences, status, searches] = await Promise.all([
        api.items(), api.notifications(), api.settings(), api.status(), api.shoppingWatches(),
      ]);
      setItems(nextItems); setNotifications(alerts); setSettings(preferences);
      setWatches(searches);
      setMonitorError(status.error ?? ''); setLastRun(status.last_run_at); setError('');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    try { return localApi().onChanged(() => { void refresh(); }); }
    catch (failure) { setError(errorMessage(failure)); }
  }, [refresh]);
  async function remove(id: string) { await localApi().deleteItem(id); await refresh(); }
  async function read(id: string) { await localApi().markRead(id); await refresh(); }
  async function save(value: SettingsData) { await localApi().saveSettings(value); await refresh(); }
  async function check() {
    setChecking(true); setCheckMessage('');
    try {
      const result = await localApi().check();
      await refresh();
      setCheckMessage(checkResultMessage(result));
      const searches = await localApi().shoppingWatches();
      if (searches.length && result.reason === 'complete') setCheckMessage(`Search checks finished. ${searches.filter(watch => watch.error).length} searches have errors; review watchlist details. ${checkResultMessage(result)}`);
    }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setChecking(false); }
  }
  const unread = notifications.filter(value => !value.read).length;
  return <div className="workspace">
    <aside className="sidebar"><div className="brand"><img className="logo" src={appIcon} alt="" /><span>Inventory<br />Checker</span></div>
      <span className="eyebrow nav-caption">ON THIS DEVICE</span><nav>
        <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>▦ Dashboard</button>
        <button className={page === 'notifications' ? 'active' : ''} onClick={() => setPage('notifications')}>♧ Notifications {unread > 0 && <span className="nav-count">{unread}</span>}</button>
        <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}>⚙ Settings</button>
      </nav><div className="sidebar-bottom"><p>Local SQLite storage</p><small>No account or server required</small>
        <small>Last run: {lastRun ? new Date(lastRun).toLocaleString() : 'Not yet'}</small>
      </div></aside>
    <main className="main-content"><header><div><span className="eyebrow">INVENTORY CHECKER</span>
      <h1>{page === 'dashboard' ? 'Your watchlist' : page === 'notifications' ? 'Stay in the loop' : 'Settings'}</h1>
      <p className="muted">Your data stays on this device. Retailer checks still require internet.</p></div>
      <button disabled={loading || checking} onClick={() => void check()}>{checking ? 'Checking…' : 'Check now'}</button></header>
      {checkMessage && <p role="status" className="muted">{checkMessage}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {monitorError && <p role="alert" className="error">{monitorError}</p>}
      {loading && <p role="status" className="loading">Opening local storage…</p>}
      {page === 'dashboard' && <><div className="stats"><article><span>TRACKED PRODUCTS</span><strong>{items.length + watches.length}</strong></article>
        <article><span>LAST REPORTED IN STOCK</span><strong>{items.filter(item => item.in_stock).length + watches.filter(watch => watch.result?.offers.some(offer => offer.match === 'text-match' && offer.availability === 'reported-in-stock')).length}</strong></article>
        <article><span>UNREAD ALERTS</span><strong>{unread}</strong></article></div>
        <ShoppingDiscovery existingCount={items.length} existingProducts={items.length ? <Dashboard embedded items={items} onDelete={remove} /> : undefined} /></>}
      {page === 'notifications' && <NotificationPanel notifications={notifications} onRead={read} />}
      {page === 'settings' && settings && <Settings settings={settings} onSave={save} />}
      <footer>Checks continue in the tray while this computer is awake. System sleep pauses checks; they catch up on wake. Exit stops monitoring.</footer>
    </main>
  </div>;
}
