// Forge/Vite injected-global declarations (RESEARCH Pitfall 2)
// The Forge Vite plugin injects these as DefinePlugin globals; without declarations
// TypeScript will error on MAIN_WINDOW_VITE_DEV_SERVER_URL in src/main/index.ts
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Side-effect CSS imports in the renderer (xterm base styles + terminal.css).
// Vite handles these at build time; TS needs an ambient module so the
// side-effect `import '...css'` type-checks (TS2882).
declare module '*.css';
