import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { meuDomInspectorPlugin } from 'vite-plugin-dom-inspector';

export default defineConfig({
  plugins: [react(), meuDomInspectorPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
