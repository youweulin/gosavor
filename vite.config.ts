import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GoSavor - 日本旅遊美食翻譯',
        short_name: 'GoSavor',
        description: 'AI 菜單翻譯・點餐・收據・記帳・旅遊日記',
        theme_color: '#f97316',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['travel', 'food', 'utilities'],
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        shortcuts: [
          { name: '掃菜單', url: '/?mode=menu', icons: [{ src: 'favicon.svg', sizes: 'any' }] },
          { name: '掃收據', url: '/?mode=receipt', icons: [{ src: 'favicon.svg', sizes: 'any' }] },
        ],
      },
    }),
  ],
});
