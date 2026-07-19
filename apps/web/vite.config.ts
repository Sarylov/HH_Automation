import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Explicit IPv4. Avoid localhost→::1 / Cursor stealing 127.0.0.1:3000.
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
