import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // Explicitly set output to 'build' to satisfy deployment platforms
  },
  define: {
    // Polyfill process.env for the existing code structure
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || process.env.VITE_API_KEY)
  }
});