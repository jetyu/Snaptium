import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: { dedupe: ['vue'] },
  server: {
    strictPort: true,
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/.well-known': 'http://127.0.0.1:3000',
    },
  },
});
