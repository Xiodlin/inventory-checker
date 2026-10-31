import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const api = new URL(env.VITE_API_URL || 'http://localhost:3000');
  if (!(api.protocol === 'https:' ||
        (api.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(api.hostname))) ||
      api.username || api.password || api.search || api.hash) {
    throw new Error('VITE_API_URL must use HTTPS, or HTTP on localhost/127.0.0.1');
  }
  const websocket = new URL(api);
  websocket.protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    plugins: [
      react(),
      {
        name: 'inventory-renderer-csp',
        transformIndexHtml: (html: string) =>
          html.replace('__API_CONNECT_SOURCES__', `${api.origin} ${websocket.origin}`),
      },
    ],
    base: './',
    publicDir: false,
    build: {
      outDir: 'dist/renderer',
      emptyOutDir: true,
      rollupOptions: { input: fileURLToPath(new URL('./public/index.html', import.meta.url)) },
    },
  };
});
