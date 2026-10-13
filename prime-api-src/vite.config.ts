import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` writes ONE self-contained ../Prime_API_Integration/index.html
// (served by backend/server.js at /Prime_API_Integration).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: '../Prime_API_Integration', emptyOutDir: true },
});
