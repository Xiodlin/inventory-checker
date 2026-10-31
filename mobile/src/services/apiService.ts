export type Retailer = 'amazon' | 'target' | 'bestbuy' | 'apple';
export interface Item {
  id: string; retailer: Retailer; brand?: string; model?: string; sku?: string; url?: string;
  current_price: number | null; in_stock: boolean | null; last_checked_at: string | null;
  target_price?: number | null;
}
export type NewItem = Pick<Item, 'retailer' | 'brand' | 'model' | 'sku' | 'url' | 'target_price'>;
export interface Notification {
  id: string; title: string; body: string; read: boolean; created_at: string;
}
export interface Settings { notifications_enabled: boolean; check_interval_minutes: number }
export interface Price { price: number; in_stock?: boolean; checked_at?: string; recorded_at?: string }
export interface AuthResult { token: string; user: { id: string; email: string } }

let baseURL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
let token: string | null = null;
let unauthorized: (() => void) | undefined;

export function validateBaseURL(value: string): string {
  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
      parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) {
    throw new Error('Enter an HTTP(S) server origin, for example http://192.168.1.20:3000.');
  }
  return parsed.origin;
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const sessionToken = token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: ['Bearer', sessionToken].join(' ') } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) {
      if (response.status === 401 && sessionToken && token === sessionToken) unauthorized?.();
      throw new Error(data?.error?.message ?? data?.error ?? data?.message ?? `Request failed (${response.status})`);
    }
    return data as T;
  } finally { clearTimeout(timeout); }
}

export const apiService = {
  setBaseURL(value: string) { baseURL = validateBaseURL(value); },
  getBaseURL: () => baseURL,
  setToken(value: string | null) { token = value; },
  onUnauthorized(callback: () => void) { unauthorized = callback; return () => { unauthorized = undefined; }; },
  websocketURL: () => `${baseURL.replace(/^http/, 'ws')}/ws`,
  authenticate: (mode: 'login' | 'register', email: string, password: string) =>
    request<AuthResult>(`/api/users/${mode}`, 'POST', { email, password }),
  items: () => request<Item[]>('/api/items'),
  item: (id: string) => request<Item>(`/api/items/${encodeURIComponent(id)}`),
  prices: (id: string) => request<Price[]>(`/api/items/${encodeURIComponent(id)}/prices`),
  addItem: (item: NewItem) => request<Item>('/api/items', 'POST', item),
  deleteItem: (id: string) => request<void>(`/api/items/${encodeURIComponent(id)}`, 'DELETE'),
  settings: () => request<Settings>('/api/settings'),
  saveSettings: (settings: Settings) => request<Settings>('/api/settings', 'PATCH', settings),
  notifications: () => request<Notification[]>('/api/notifications'),
  markRead: (id: string) => request<Notification>(`/api/notifications/${encodeURIComponent(id)}`, 'PATCH', { read: true }),
  registerDevice: (deviceToken: string) => request<void>('/api/notifications/devices', 'POST', { token: deviceToken }),
  removeDevice: (deviceToken: string) => request<void>('/api/notifications/devices', 'DELETE', { token: deviceToken }),
};
