import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: any;

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // Standard Vite output directory expected by Vercel
  },
  define: {
    // Polyfill process.env for the existing code structure
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || process.env.VITE_API_KEY)
  }
});