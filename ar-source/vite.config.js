import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // 相对路径可同时部署在 Vercel 根域名和 GitHub Pages 仓库子路径下。
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        preview: resolve(import.meta.dirname, 'preview.html'),
      },
    },
  },
});
