import { defineConfig } from 'vite';

export default defineConfig({
  root: 'podtest',
  publicDir: 'public',
  server: {
    port: 3001,
    open: true
  }
});
