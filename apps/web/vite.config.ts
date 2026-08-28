import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom|react-router)[\\/]/,
              priority: 30,
            },
            {
              name: 'state-vendor',
              test: /node_modules[\\/](?:@tanstack|i18next|react-i18next|zustand)[\\/]/,
              priority: 20,
            },
            {
              name: 'mock-vault',
              test: /packages[\\/]mock-vault[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
})
