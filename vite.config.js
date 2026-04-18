import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Cambia 'droppmoney' con il nome esatto del tuo repo GitHub
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Droppmoney',
        short_name: 'Droppmoney',
        description: 'Il tuo portafoglio finanziario personale',
        theme_color: '#1c2d4f',
        background_color: '#0f1a2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/droppmoney/',
        icons: [
          { src: 'logo.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'github-data',
              expiration: { maxAgeSeconds: 3600 }
            }
          }
        ]
      }
    })
  ]
})
