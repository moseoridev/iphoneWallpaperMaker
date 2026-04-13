import { svelteTesting } from '@testing-library/svelte/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const base = '/'

export default defineConfig({
  base,
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  plugins: [
    svelte(),
    svelteTesting(),
    VitePWA({
      base,
      injectRegister: 'script-defer',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: base,
        name: 'Wallpaper Letterbox Maker',
        short_name: 'Wallpaper Maker',
        description:
          '사진 비율을 유지한 채 목표 해상도에 맞는 레터박스 배경화면을 오프라인으로 만듭니다.',
        lang: 'ko-KR',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f5f5f7',
        theme_color: '#f5f5f7',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        globIgnores: ['**/assets/heic-to-*.js'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/heic-to-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'heic-converter',
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 3000,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
