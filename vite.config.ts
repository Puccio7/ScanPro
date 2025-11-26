import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // Output folder name
  },
  // Remove 'define' block as we now use import.meta.env standard
});