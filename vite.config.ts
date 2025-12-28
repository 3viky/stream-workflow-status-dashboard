import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/ui',
  build: {
    outDir: '../../dashboard',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@types': path.resolve(__dirname, 'src/types'),
    },
  },
  server: {
    port: 5174,
  },
});
