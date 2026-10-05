import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: { dedupe: ['vue'] },
  test: {
    environment: 'jsdom',
    include: ['tests/web/**/*.test.ts'],
    restoreMocks: true,
  },
});
