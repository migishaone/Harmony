import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDirectory, '');
  const port = Number(env.PORT || 3032);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a valid port number. Received: ${env.PORT}`);
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDirectory, 'src'),
      },
    },
    server: {
      host: 'localhost',
      port,
      strictPort: true,
    },
    preview: {
      host: 'localhost',
      port,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            audio: ['tone'],
            'hand-tracking': ['@mediapipe/tasks-vision'],
            react: ['react', 'react-dom', 'wouter'],
          },
        },
      },
    },
  };
});
