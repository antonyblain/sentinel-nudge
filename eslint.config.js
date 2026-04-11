import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        chrome: 'readonly',
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        HTMLElement: 'readonly',
        ShadowRoot: 'readonly',
        CustomEvent: 'readonly',
        navigator: 'readonly',
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBObjectStore: 'readonly',
        IDBTransaction: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Uint8Array: 'readonly',
        ArrayBuffer: 'readonly',
        TextEncoder: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        MutationObserver: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        ClipboardEvent: 'readonly',
        FocusEvent: 'readonly',
        HTMLInputElement: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true, allowConciseArrowFunctionExpressionsStartingWithVoid: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'Element',
          property: 'innerHTML',
          message: 'D-SEC-003: innerHTML interdit — utiliser textContent, createElement et appendChild.',
        },
        {
          object: 'Element',
          property: 'outerHTML',
          message: 'D-SEC-003: outerHTML interdit — utiliser createElement et remplacement de noeud.',
        },
        {
          object: 'Element',
          property: 'insertAdjacentHTML',
          message: 'D-SEC-003: insertAdjacentHTML interdit — utiliser insertAdjacentElement ou appendChild.',
        },
        {
          object: 'document',
          property: 'write',
          message: 'D-SEC-003: document.write interdit.',
        },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.ts', '*.config.js'],
  },
];
