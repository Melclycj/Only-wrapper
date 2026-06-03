// Forge/Vite injected-global declarations (RESEARCH Pitfall 2)
// The Forge Vite plugin injects these as DefinePlugin globals; without declarations
// TypeScript will error on MAIN_WINDOW_VITE_DEV_SERVER_URL in src/main/index.ts
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
