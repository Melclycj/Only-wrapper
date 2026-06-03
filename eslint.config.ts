import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // 0. Global ignores — never lint build output or deps (flat config ignores
  // node_modules/.git by default, but NOT these generated dirs). Without this,
  // `npm run lint` fails on the minified .vite/out bundles after any build.
  {
    ignores: ['.vite/**', 'out/**', 'dist/**', 'coverage/**'],
  },

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
            {
              group: ['node-pty', 'node-pty/*'],
              message:
                'node-pty is a main-process native module — never import it in the renderer (CLAUDE.md: What NOT to Use). PTY runs in main; the renderer reaches it via window.api.',
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
            {
              group: ['node-pty', 'node-pty/*'],
              message:
                'shared/ is pure TypeScript — never import node-pty here (it is a main-process native module).',
            },
          ],
        },
      ],
    },
  },

  // 4. Prettier last — must be trailing entry to override formatting rules
  eslintConfigPrettier,
);
