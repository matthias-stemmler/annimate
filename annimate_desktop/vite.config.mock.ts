import path from 'path';
import { defineConfig, mergeConfig } from 'vite';
import viteConfig from './vite.config.ts';

console.log('--- Running in mock mode ---');

// Replaces the real API with a mock version, see `src/lib/__mocks__/api.ts`
export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      // Array form makes `mergeConfig` put this before the base config's `@` alias
      // (two object forms would be spread into one object with `@` first)
      alias: [
        {
          find: '@/lib/api',
          replacement: path.resolve(
            import.meta.dirname,
            './src/lib/__mocks__/api.ts',
          ),
        },
      ],
    },
  }),
);
