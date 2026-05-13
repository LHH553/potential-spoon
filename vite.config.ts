import { defineConfig } from 'vite';

export default defineConfig({
  base: '/potential-spoon/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    open: true,
  },
});
