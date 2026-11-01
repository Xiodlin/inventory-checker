import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { API_URL, errorMessage, request, WS_URL } from './api';
import AddItem from './components/AddItem';
import Dashboard from './components/Dashboard';
import NotificationPanel from './components/NotificationPanel';
import Settings from './components/Settings';
import type { InventoryNotification, Item, NewItem, SettingsData, User } from './types';

interface Session { token: string; user: User }
type Page = 'dashboard' | 'notifications' | 'settings';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  return session ? <Workspace key={session.token} session={session} signOut={() => setSession(null)} /> :
    <Authentication onAuthenticated={setSession} />;
}

function Authentication({ onAuthenticated }: { onAuthenticated(session: Session): void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const session = await request<Session>(`/api/users/${register ? 'register' : 'login'}`, null, {
        method: 'POST',
        body: JSON.stringify({ email: String(values.get('email')).trim(), password: values.get('password') }),
      });
      if (!session.token || !session.user?.email) throw new Error('Invalid authentication response');
      onAuthenticated(session);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <main className="auth-layout">
    <section className="auth-intro"><div className="brand"><span className="logo">◇</span>Inventory Checker</div><span className="eyebrow">LESS SEARCHING. MORE KNOWING.</span><h1>Your next find,<br /><span>on your radar.</span></h1><p>Keep your products in one place, follow price changes, and get notified when inventory moves.</p><div className="intro-features"><span>◉ Inventory watchlist</span><span>↘ Price history</span><span>♧ Desktop alerts</span></div><small>Local backend · {API_URL}</small></section>
    <section className="auth-card"><span className="eyebrow">WELCOME {register ? 'ABOARD' : 'BACK'}</span><h2>{register ? 'Create your account' : 'Sign in to your watchlist'}</h2><p className="muted">Your session stays in memory, never in browser storage.</p>
      <form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label><label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : 1} maxLength={128} required /></label><button className="primary" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button></form>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="text-button" disabled={busy} onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
    </section>
  </main>;
}

function Workspace({ session, signOut }: { session: Session; signOut(): void }) {
  const [page, setPage] = useState<Page>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [notifications, setNotifications] = useState<InventoryNotification[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('Connecting');
  const enabledRef = useRef(false);
  const alive = useRef(true);
  enabledRef.current = settings?.notifications_enabled ?? false;
  const { token } = session;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const [newItems, newNotifications, newSettings] = await Promise.all([
        request<Item[]>('/api/items', token, { signal }),
        request<InventoryNotification[]>('/api/notifications', token, { signal }),
        request<SettingsData>('/api/settings', token, { signal }),
      ]);
      if (alive.current && !signal?.aborted) {
        setItems(newItems); setNotifications(newNotifications); setSettings(newSettings);
      }
    } catch (failure) {
      if (alive.current && !signal?.aborted) setError(errorMessage(failure));
    } finally { if (alive.current && !signal?.aborted) setLoading(false); }
  }, [token]);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => { alive.current = false; controller.abort(); };
  }, [refresh]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let authenticatedOnce = false;
    function connect() {
      if (disposed) return;
      setConnection('Connecting');
      socket = new WebSocket(WS_URL);
      socket.onopen = () => {
        if (disposed) { socket?.close(); return; }
        socket?.send(JSON.stringify({ type: 'auth', token }));
        setConnection('Authenticating');
      };
      socket.onmessage = event => {
        if (disposed) return;
        try {
          const message = JSON.parse(String(event.data));
          if (message.type === 'authenticated') {
            setConnection('Connected');
            if (authenticatedOnce) void refresh();
            authenticatedOnce = true;
          } else if (message.type === 'notification' && message.notification?.id != null &&
              typeof message.notification.title === 'string' && typeof message.notification.body === 'string') {
            const notification = message.notification as InventoryNotification;
            setNotifications(previous => [notification, ...previous.filter(value => value.id !== notification.id)]);
            if (enabledRef.current && notification.title.length <= 120 && notification.body.length <= 1000) {
              void window.inventoryDesktop?.notify(notification.title, notification.body).catch(() => {
                if (!disposed) setError('Native notification unavailable. Your alert is saved in Notifications.');
              });
            }
          } else if (message.type === 'item.updated' && message.item?.id != null) {
            const item = message.item as Item;
            setItems(previous => previous.map(value => value.id === item.id ? { ...value, ...item } : value));
          }
        } catch { /* Ignore malformed server events without interrupting the session. */ }
      };
      socket.onerror = () => { if (!disposed) setConnection('Reconnecting'); };
      socket.onclose = event => {
        if (disposed) return;
        if (event.code === 1008) {
          setConnection('Authentication rejected'); setError('Live connection rejected. Sign in again.'); return;
        }
        setConnection('Reconnecting');
        retry = setTimeout(connect, 5000);
      };
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      if (socket) {
        socket.onopen = null; socket.onmessage = null; socket.onerror = null; socket.onclose = null;
        socket.close();
      }
    };
  }, [token, refresh]);

  async function add(item: NewItem) {
    const created = await request<Item>('/api/items', token, { method: 'POST', body: JSON.stringify(item) });
    if (alive.current) setItems(previous => [...previous.filter(value => value.id !== created.id), created]);
  }
  async function remove(id: Item['id']) {
    await request(`/api/items/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
    if (alive.current) setItems(previous => previous.filter(item => item.id !== id));
  }
  async function read(id: InventoryNotification['id']) {
    await request(`/api/notifications/${encodeURIComponent(id)}`, token, { method: 'PATCH', body: JSON.stringify({ read: true }) });
    if (alive.current) setNotifications(previous => previous.map(value => value.id === id ? { ...value, read: true } : value));
  }
  async function save(value: SettingsData) {
    const updated = await request<SettingsData>('/api/settings', token, { method: 'PATCH', body: JSON.stringify(value) });
    if (alive.current) setSettings(updated);
  }
  const unread = notifications.filter(notification => !notification.read).length;
  return <div className="workspace">
    <aside className="sidebar"><div className="brand"><span className="logo">◇</span><span>Inventory<br />Checker</span></div><span className="eyebrow nav-caption">WORKSPACE</span><nav>
      <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>▦ Dashboard</button>
      <button className={page === 'notifications' ? 'active' : ''} onClick={() => setPage('notifications')}>♧ Notifications {unread > 0 && <span className="nav-count">{unread}</span>}</button>
      <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}>⚙ Settings</button>
    </nav><div className="sidebar-bottom"><p><span className={`status-dot ${connection === 'Connected' ? 'online' : ''}`} />{connection}</p><small>{session.user.email}</small><button onClick={signOut}>Sign out</button></div></aside>
    <main className="main-content"><header><div><span className="eyebrow">INVENTORY CHECKER</span><h1>{page === 'dashboard' ? 'Your watchlist' : page === 'notifications' ? 'Stay in the loop' : 'Settings'}</h1><p className="muted">{page === 'dashboard' ? 'The products you want. The updates you need.' : 'Keep your inventory workflow under control.'}</p></div><button disabled={loading} onClick={() => void refresh()}>{loading ? 'Refreshing…' : '↻ Refresh'}</button></header>
      {error && <p role="alert" className="error">{error}</p>}
      {loading && <p role="status" className="loading">Loading your workspace…</p>}
      {page === 'dashboard' && <><div className="stats"><article><span>TRACKED PRODUCTS</span><strong>{items.length}</strong></article><article><span>IN STOCK</span><strong>{items.filter(item => item.in_stock).length}</strong></article><article><span>UNREAD ALERTS</span><strong>{unread}</strong></article></div><AddItem onAdd={add} /><Dashboard items={items} token={token} onDelete={remove} /></>}
      {page === 'notifications' && <NotificationPanel notifications={notifications} onRead={read} />}
      {page === 'settings' && settings && <Settings settings={settings} onSave={save} />}
      {page === 'settings' && !settings && !loading && <p className="muted">Settings could not be loaded. Use Refresh to try again.</p>}
      <footer>Inventory Checker · Close the window to keep running in the system tray. Use tray Exit to quit.</footer>
    </main>
  </div>;
}
