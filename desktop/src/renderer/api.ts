const configuredUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const base = new URL(configuredUrl);
if (!(base.protocol === 'https:' ||
      (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) ||
    base.username || base.password || base.search || base.hash) {
  throw new Error('VITE_API_URL must use HTTPS, or HTTP on localhost/127.0.0.1');
}
export const API_URL = base.href.replace(/\/$/, '');
export const WS_URL = `${API_URL.replace(/^http/, 'ws')}/ws`;
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

export async function request<T>(
  path: string, token: string | null, options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: ['Bearer', token].join(' ') } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
