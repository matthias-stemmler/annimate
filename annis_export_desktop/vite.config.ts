/// <reference types="vitest" />

import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const isMock = !!process.env.MOCK;

  if (isMock) {
    console.log('--- Running in mock mode ---');
  }

  return {
    clearScreen: false,
    plugins: [react()],
    resolve: {
      alias: {
        '@/lib/api': path.resolve(
          __dirname,
          isMock ? './src/lib/__mocks__/api.ts' : './src/lib/api.ts',
        ),
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
      sequence: {
        shuffle: true,
      },
    },
  };
});
