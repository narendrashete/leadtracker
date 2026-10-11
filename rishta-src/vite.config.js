import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` writes ONE self-contained ../rishta/index.html (served by backend/server.js at /rishta).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { target: 'es2022', chunkSizeWarningLimit: 4000, outDir: '../rishta', emptyOutDir: true },
  worker: { format: 'es' },
});
