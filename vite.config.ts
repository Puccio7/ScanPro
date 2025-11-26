import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // Output folder name for Vercel
    chunkSizeWarningLimit: 1000, // Increase limit to suppress warnings
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks for better caching
          vendor: ['react', 'react-dom'],
          utils: ['xlsx', 'jspdf', 'jspdf-autotable', 'html5-qrcode'],
          ai: ['@google/genai']
        }
      }
    }
  },
});