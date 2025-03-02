// @ts-check

import eslint from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const importRuleAt = {
  group: ['./*', '../*'],
  message: 'Import from @/* instead.',
};

const importRuleNoTauri = {
  group: ['@tauri-apps/*'],
  message: 'Import from @tauri-apps/* only in api.ts and tests',
};

export default tseslint.config(
  /***** ESLint recommended *****/
  eslint.configs.recommended,

  /***** typescript-eslint recommended *****/
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    ignores: ['**/*.js'],
  })),

  /***** Plugins *****/
  ...pluginQuery.configs['flat/recommended'],
  pluginReactHooks.configs['recommended-latest'],
  pluginReactRefresh.configs.vite,

  /***** Custom config *****/

  {
    ignores: ['dist/**'],
  },

  // Disallow imports without '@/*' and from '@tauri-apps/*'
  // (with exceptions, see below)
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [importRuleAt, importRuleNoTauri],
        },
      ],
    },
  },

  // Exception 1: Import from '@tauri-apps/*' is allowed from api and tests
  {
    files: ['src/lib/api.ts', 'src/lib/api-types.ts', 'src/**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [importRuleAt],
        },
      ],
    },
  },

  // Exception 2: Import without '@/*' is allowed from mocks
  {
    files: ['src/**/__mocks__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [importRuleNoTauri],
        },
      ],
    },
  },

  // Disable certain rules for shadcn-ui components
  {
    files: ['src/components/ui/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
