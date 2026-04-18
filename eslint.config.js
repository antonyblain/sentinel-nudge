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
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowConciseArrowFunctionExpressionsStartingWithVoid: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'Element',
          property: 'innerHTML',
          message:
            'D-SEC-003: innerHTML interdit — utiliser textContent, createElement et appendChild.',
        },
        {
          object: 'Element',
          property: 'outerHTML',
          message:
            'D-SEC-003: outerHTML interdit — utiliser createElement et remplacement de noeud.',
        },
        {
          object: 'Element',
          property: 'insertAdjacentHTML',
          message:
            'D-SEC-003: insertAdjacentHTML interdit — utiliser insertAdjacentElement ou appendChild.',
        },
        {
          object: 'document',
          property: 'write',
          message: 'D-SEC-003: document.write interdit.',
        },
      ],
      // ---------------------------------------------------------------------------
      // R-M7-08 / TACHE-083 — Interdiction de passer des données sensibles à console.*
      //
      // Ces règles implémentent INV-SEC-02 étendu aux logs console :
      //   - err.message peut contenir des données utilisateur (ex: "Invalid value 'abc'")
      //   - String(err) sérialise le message brut de l'erreur
      //   - location.href / URL complètes exposent path, query, fragment
      //
      // Remplacements attendus :
      //   err.message   → Logger.errorName(err)
      //   String(err)   → Logger.errorName(err)
      //   console.*(url) → logger.*(msg, { hostname: Logger.hostnameOf(url) })
      //
      // Voir src/shared/utils/logger.ts pour le guide de migration complet.
      // Les tests (tests/**) sont exclus : les spies console.* sont légitimes.
      // ---------------------------------------------------------------------------
      'no-restricted-syntax': [
        'error',
        {
          // Interdit : console.*(... .message ...) — err.message dans un appel console.*
          selector:
            "CallExpression[callee.object.name='console'] MemberExpression[property.name='message']",
          message:
            'TACHE-083 / R-M7-08 : ne pas passer .message à console.* — utiliser Logger.errorName(err) ou logger.*(..., { error_name: Logger.errorName(err) }). Voir src/shared/utils/logger.ts',
        },
        {
          // Interdit : console.*(... String(err) ...) — sérialise le message brut
          selector:
            "CallExpression[callee.object.name='console'] > CallExpression[callee.name='String']",
          message:
            'TACHE-083 / R-M7-08 : ne pas passer String(err) à console.* — utiliser Logger.errorName(err). Voir src/shared/utils/logger.ts',
        },
        {
          // Interdit : console.*(... location.href ...) — URL complète avec path/query
          selector:
            "CallExpression[callee.object.name='console'] MemberExpression[object.name='location'][property.name='href']",
          message:
            'TACHE-083 / R-M7-08 : ne pas passer location.href à console.* — utiliser Logger.hostnameOf(url) ou logger.*(..., { hostname: Logger.hostnameOf(url) }). Voir src/shared/utils/logger.ts',
        },
        {
          // Interdit : const message = err.message (pattern indirect de fuite via variable)
          // TACHE-104 : 12 sites SW handlers utilisaient ce pattern.
          selector:
            "VariableDeclarator[id.name='message'] > MemberExpression[property.name='message']",
          message:
            'TACHE-083+104 / R-M7-08 : const message = err.message capture un message brut susceptible de contenir des donnees utilisateur — utiliser classifyError(err) dans logger.*(..., { error_code: classifyError(err) }). Voir src/shared/utils/classify-error.ts',
        },
        {
          // Interdit : console.log() direct dans src/ — doit passer par la factory logger
          selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
          message:
            'TACHE-083 / R-M7-08 : console.log() direct interdit dans src/ — utiliser createLogger(scope).info/warn/error(). Voir src/shared/utils/logger.ts',
        },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.ts', '*.config.js'],
  },
];
