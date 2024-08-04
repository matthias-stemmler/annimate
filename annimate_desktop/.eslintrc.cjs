const importRuleAt = {
  group: ['./*', '../*'],
  message: 'Import from @/* instead.',
};

const importRuleNoTauri = {
  group: ['@tauri-apps/*'],
  message: 'Import from @tauri-apps/* only in api.ts and tests',
};

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@tanstack/eslint-plugin-query/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['@tanstack/query', 'react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [importRuleAt, importRuleNoTauri],
      },
    ],
  },
  overrides: [
    // Allow Tauri imports in api and tests
    {
      files: [
        'src/lib/api.ts',
        'src/lib/api-types.ts',
        'src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [importRuleAt],
          },
        ],
      },
    },

    // Allow relative imports in mocks
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
  ],
};
