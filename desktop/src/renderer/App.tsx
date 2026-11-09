import { useCallback, useEffect, useState } from 'react';
import { checkResultMessage, notificationTarget, type NotificationTarget } from '@inventory-checker/core/src/types';
import { errorMessage, localApi } from './api';
import Dashboard from './components/Dashboard';
import NotificationPanel from './components/NotificationPanel';
import Settings from './components/Settings';
import ShoppingDiscovery from './components/ShoppingDiscovery';
import type { InventoryNotification, Item, SettingsData, ShoppingWatch } from './types';
import appIcon from '../../public/assets/icon.png';
import { Button } from './components/Button';
import { Alert, Badge, Card, Spinner } from './components/UI';

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
  const [focus, setFocus] = useState<{ target: NotificationTarget; request: number } | null>(null);
  const [navigationMessage, setNavigationMessage] = useState('');
  const openTarget = useCallback(async (value: NotificationTarget | null) => {
    const target = notificationTarget(value);
    setPage('dashboard'); setFocus(null);
    if (!target) { setNavigationMessage('This older notification has no product link.'); return; }
    const api = localApi();
    const exists = target.kind === 'item' ? (await api.items()).some(item => item.id === target.id)
      : (await api.shoppingWatches()).some(watch => watch.id === target.id);
    setNavigationMessage(exists ? '' : 'The product linked to this notification has been removed.');
    if (exists) setFocus({ target, request: Date.now() });
  }, []);
  useEffect(() => localApi().onNotificationOpen(target => {
    void openTarget(target).catch(failure => setError(errorMessage(failure)));
  }), [openTarget]);
  useEffect(() => {
    if (!focus || focus.target.kind !== 'item' || page !== 'dashboard') return;
    const card = document.getElementById(`product-${focus.target.kind}-${focus.target.id}`);
    if (!card) return;
    const details = card.querySelector<HTMLDetailsElement>('.watch-details');
    if (details) details.open = true;
    card.classList.add('notification-target');
    card.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    card.focus({ preventScroll: true });
    return () => card.classList.remove('notification-target');
  }, [focus, page, items, watches]);
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
  async function clearNotifications() { await localApi().clearNotifications(); await refresh(); }
  async function dismissNotification(id: string) { await localApi().deleteNotification(id); await refresh(); }
  async function openNotification(alert: InventoryNotification) {
    if (!alert.read) await localApi().markRead(alert.id);
    await openTarget(alert.target ?? null);
    await refresh();
  }
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
      <span className="eyebrow nav-caption">ON THIS DEVICE</span><nav aria-label="Main navigation">
        <Button variant="ghost" aria-current={page === 'dashboard' ? 'page' : undefined} onClick={() => setPage('dashboard')}>▦ Dashboard</Button>
        <Button variant="ghost" aria-current={page === 'notifications' ? 'page' : undefined} onClick={() => setPage('notifications')}>♧ Notifications {unread > 0 && <Badge className="nav-count" tone="info">{unread}</Badge>}</Button>
        <Button variant="ghost" aria-current={page === 'settings' ? 'page' : undefined} onClick={() => setPage('settings')}>⚙ Settings</Button>
      </nav><div className="sidebar-bottom"><p>Local SQLite storage</p><small>No account or server required</small>
        <small>Last run: {lastRun ? new Date(lastRun).toLocaleString() : 'Not yet'}</small>
      </div></aside>
    <main className="main-content"><header className="page-heading"><div><span className="eyebrow">INVENTORY CHECKER</span>
      <h1>{page === 'dashboard' ? 'Your watchlist' : page === 'notifications' ? 'Stay in the loop' : 'Settings'}</h1>
      <p className="muted">Your data stays on this device. Retailer checks still require internet.</p></div>
      <Button disabled={loading} loading={checking} onClick={() => void check()}>{checking ? 'Checking…' : 'Check now'}</Button></header>
      {checkMessage && <Alert role="status" tone="info" title={checkMessage} />}
      {error && <Alert role="alert" tone="error" title={error} />}
      {navigationMessage && <Alert role="status" title={navigationMessage} />}
      {monitorError && <Alert role="alert" tone="error" title={monitorError} />}
      {loading && <Spinner label="Opening local storage…" />}
      {page === 'dashboard' && <><div className="stats"><Card title="TRACKED PRODUCTS"><strong>{items.length + watches.length}</strong></Card>
        <Card title="LAST REPORTED IN STOCK"><strong>{items.filter(item => item.in_stock).length + watches.filter(watch => watch.result?.offers.some(offer => offer.match === 'text-match' && offer.availability === 'reported-in-stock')).length}</strong></Card>
        <Card title="UNREAD ALERTS"><strong>{unread}</strong></Card></div>
        <ShoppingDiscovery focus={focus?.target.kind === 'shopping' ? { id: focus.target.id, request: focus.request } : null}
          existingCount={items.length} existingProducts={items.length ? <Dashboard embedded items={items} onDelete={remove} /> : undefined} /></>}
      {page === 'notifications' && <NotificationPanel notifications={notifications} onRead={read} onClear={clearNotifications}
        onDismiss={dismissNotification} onOpen={openNotification} />}
      {page === 'settings' && settings && <Settings settings={settings} onSave={save} />}
      <footer>Checks continue in the tray while this computer is awake. System sleep pauses checks; they catch up on wake. Exit stops monitoring.</footer>
    </main>
  </div>;
}
