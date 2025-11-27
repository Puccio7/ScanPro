import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  // Create a safe process.env object with the API Key
  const processEnvValues = {
    ...env,
    API_KEY: env.API_KEY || env.VITE_API_KEY,
    NODE_ENV: mode
  };

  return {
    // CRITICAL: Base path must be relative for GitHub Pages or subfolder deployment
    base: './',
    plugins: [react()],
    define: {
      // CRITICAL: Polyfill process.env so the Google GenAI SDK works in the browser.
      // We JSON.stringify to ensure it's injected as a code literal object.
      'process.env': JSON.stringify(processEnvValues)
    },
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
  };
});