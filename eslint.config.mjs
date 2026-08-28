import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.features-gen/**',
      '**/.stryker-tmp/**',
      '**/reports/**',
      '**/.wrangler/**',
      '**/node_modules/**',
      '**/worker-configuration.d.ts',
      '**/*.gen.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'apps/*/src/**/*.{ts,tsx}',
      'apps/e2e/steps/**/*.ts',
      'packages/*/src/**/*.{ts,tsx}',
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    },
  },
  {
    files: ['.dependency-cruiser.cjs'],
    languageOptions: { globals: { module: 'readonly' } },
  },
  {
    files: ['apps/e2e/scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        localStorage: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['packages/contracts/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'hono',
            '@hono/*',
            'cloudflare:*',
            '@cloudflare/*',
            'react',
            'react-*',
            'node:*',
            'fs',
            'fs/*',
          ],
        },
      ],
    },
  },
  prettier,
)
