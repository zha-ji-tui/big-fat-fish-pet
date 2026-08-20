import { defineConfig } from 'vite';

// Tauri v2 + vanilla JS。dev 端口固定，供 Tauri dev 加载。
export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2021',
    minify: false,
    sourcemap: true,
  },
});
