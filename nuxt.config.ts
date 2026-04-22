export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: false,
  devtools: { enabled: true },

  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
    },
  },

  modules: ['@pinia/nuxt'],

  css: ['~/assets/style.css'],

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'xiantu_secret_key_2026',
    cronSecret: process.env.CRON_SECRET || '',
  },

  nitro: {
    preset: 'vercel',
  },
})
