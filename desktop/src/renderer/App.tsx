import { useCallback, useEffect, useState } from 'react';
import { checkResultMessage } from '@inventory-checker/core/dist/types';
import { errorMessage, localApi } from './api';
import AddItem from './components/AddItem';
import Dashboard from './components/Dashboard';
import NotificationPanel from './components/NotificationPanel';
import Settings from './components/Settings';
import ShoppingDiscovery from './components/ShoppingDiscovery';
import type { InventoryNotification, Item, NewItem, SettingsData } from './types';

type Page = 'dashboard' | 'notifications' | 'settings' | 'shopping';
export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
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
      const [nextItems, alerts, preferences, status] = await Promise.all([
        api.items(), api.notifications(), api.settings(), api.status(),
      ]);
      setItems(nextItems); setNotifications(alerts); setSettings(preferences);
      setMonitorError(status.error ?? ''); setLastRun(status.last_run_at); setError('');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    try { return localApi().onChanged(() => { void refresh(); }); }
    catch (failure) { setError(errorMessage(failure)); }
  }, [refresh]);
  async function add(item: NewItem) {
    await localApi().addItem(item);
    await refresh();
    void localApi().checkDue().catch(failure => setError(errorMessage(failure)));
  }
  async function remove(id: string) { await localApi().deleteItem(id); await refresh(); }
  async function read(id: string) { await localApi().markRead(id); await refresh(); }
  async function save(value: SettingsData) { await localApi().saveSettings(value); await refresh(); }
  async function check() {
    setChecking(true); setCheckMessage('');
    try {
      const result = await localApi().check();
      await refresh();
      setCheckMessage(checkResultMessage(result));
    }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setChecking(false); }
  }
  const unread = notifications.filter(value => !value.read).length;
  return <div className="workspace">
    <aside className="sidebar"><div className="brand"><span className="logo">◇</span><span>Inventory<br />Checker</span></div>
      <span className="eyebrow nav-caption">ON THIS DEVICE</span><nav>
        <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>▦ Dashboard</button>
        <button className={page === 'shopping' ? 'active' : ''} onClick={() => setPage('shopping')}>Find this product</button>
        <button className={page === 'notifications' ? 'active' : ''} onClick={() => setPage('notifications')}>♧ Notifications {unread > 0 && <span className="nav-count">{unread}</span>}</button>
        <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}>⚙ Settings</button>
      </nav><div className="sidebar-bottom"><p>Local SQLite storage</p><small>No account or server required</small>
        <small>Last run: {lastRun ? new Date(lastRun).toLocaleString() : 'Not yet'}</small>
      </div></aside>
    <main className="main-content"><header><div><span className="eyebrow">INVENTORY CHECKER</span>
      <h1>{page === 'dashboard' ? 'Your watchlist' : page === 'notifications' ? 'Stay in the loop' : page === 'shopping' ? 'Shopping discovery' : 'Settings'}</h1>
      <p className="muted">Your data stays on this device. Retailer checks still require internet.</p></div>
      <button disabled={loading || checking} onClick={() => void check()}>{checking ? 'Checking…' : 'Check now'}</button></header>
      {checkMessage && <p role="status" className="muted">{checkMessage}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {monitorError && <p role="alert" className="error">{monitorError}</p>}
      {loading && <p role="status" className="loading">Opening local storage…</p>}
      {page === 'dashboard' && <><div className="stats"><article><span>TRACKED PRODUCTS</span><strong>{items.length}</strong></article>
        <article><span>IN STOCK</span><strong>{items.filter(item => item.in_stock).length}</strong></article>
        <article><span>UNREAD ALERTS</span><strong>{unread}</strong></article></div><AddItem onAdd={add} /><Dashboard items={items} onDelete={remove} /></>}
      {page === 'notifications' && <NotificationPanel notifications={notifications} onRead={read} />}
      {page === 'settings' && settings && <Settings settings={settings} onSave={save} />}
      {page === 'shopping' && <ShoppingDiscovery />}
      <footer>Checks continue in the tray while this computer is awake. System sleep pauses checks; they catch up on wake. Exit stops monitoring.</footer>
    </main>
  </div>;
}
