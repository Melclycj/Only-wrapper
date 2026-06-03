import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // 1. Base TypeScript rules for ALL source (.ts and .tsx files)
  ...tseslint.configs.recommended,

  // 2. Renderer-only security rule — scoped to src/renderer/** ONLY (D-06)
  // This establishes the edit-time guard that Plan 03's renderer must satisfy
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*'],
              message:
                'Never import from electron in the renderer. Use window.api (contextBridge) instead.',
            },
            {
              group: ['*/ipcRenderer', '*ipcRenderer*'],
              message:
                'ipcRenderer is not accessible in renderer. Use window.api (contextBridge).',
            },
          ],
        },
      ],
    },
  },

  // 3. Defense-in-depth: also ban electron imports under src/shared/**
  // shared/ must not import electron anyway (it is pure TypeScript)
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*'],
              message:
                'shared/ is pure TypeScript — never import from electron here.',
            },
          ],
        },
      ],
    },
  },

  // 4. Prettier last — must be trailing entry to override formatting rules
  eslintConfigPrettier,
);
