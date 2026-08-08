import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // ngrok / telefon uchun
    port: 5173,
    allowedHosts: true   // ngrok domenlariga ruxsat
  },
  build: { outDir: 'dist' }
});
