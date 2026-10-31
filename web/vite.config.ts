import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';

// The bundle is built into the host app and served by the game server on the host device.
export default defineConfig({
  plugins: [
    preact(),
    // Current browsers (the 2025 Samsung TV runs Chromium 130) get the modern bundle; only older
    // ones download this legacy one. Chromium 56 is Tizen 4 (2018 TVs). See spec §2.2.
    legacy({ targets: ['chrome >= 56', 'safari >= 12'] }),
  ],
  build: { outDir: 'dist', emptyOutDir: true },
});
