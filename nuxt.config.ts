export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: false,
  devtools: { enabled: true },

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
