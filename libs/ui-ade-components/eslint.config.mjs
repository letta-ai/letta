import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import baseConfig from '../../eslint.config.mjs';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: ['**/dist'],
  },
  ...baseConfig,
  ...compat.extends(
    'plugin:cypress/recommended',
    //'plugin:@nx/react-typescript',
    'next',
    'next/core-web-vitals',
  ),
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'react/forbid-component-props': [
        'error',
        {
          forbid: ['style'],
        },
      ],
      '@next/next/no-html-link-for-pages': ['error', 'apps/letta/pages'],
      '@typescript-eslint/no-unused-vars': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    // Override or add rules here
    rules: {},
  },

  ...compat
    .config({
      env: {
        jest: true,
      },
    })
    .map((config) => ({
      ...config,
      files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
      rules: {
        ...config.rules,
      },
    })),
  {
    files: ['**/*.cy.{ts,js,tsx,jsx}', 'cypress/**/*.{ts,js,tsx,jsx}'],
    // Override or add rules here
    rules: {},
  },
  {
    ignores: ['.next/**/*', '**/*.config.js'],
  },
];
