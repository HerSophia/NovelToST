import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@util': fileURLToPath(new URL('./util', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.spec.ts', 'tests/**/*.int.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/novelToST/**/*.{ts,vue}'],
      exclude: ['src/novelToST/ui/**', 'src/novelToST/index.ts'],
    },
  },
});
