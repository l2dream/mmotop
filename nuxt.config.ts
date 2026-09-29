import { DEFAULT_LOCALE, READY_LOCALES, bcp47 } from './app/i18n/locales'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  devtools: { enabled: true },

  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
    // <html lang> and <html dir> are no longer set here: @nuxtjs/i18n writes
    // both per page, which is the only way they can be right on /ru/ as well
    // as on /.
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      /**
       * The year the site was built, baked in so the prerendered HTML already
       * knows which dates count as "this year" and can leave their year label
       * off. Without it every page shipped fifteen year labels that were
       * deleted one frame after hydration — a visible reflow on every load in
       * every language. The browser still corrects this on mount, so the only
       * stale window is between New Year and the next deploy.
       */
      buildYear: new Date().getFullYear()
    }
  },

  nitro: {
    prerender: {
      crawlLinks: true
    }
  },

  modules: ['@nuxtjs/i18n', '~~/modules/sitemap'],

  i18n: {
    /**
     * Built from the registry rather than written out again, so a language
     * cannot exist in the selector and not in the routing, or the reverse.
     * READY_LOCALES is deliberately the translated ones only — see the note
     * on it in app/i18n/locales.ts.
     */
    locales: READY_LOCALES.map(l => ({
      code: l.code,
      language: bcp47(l.code),
      dir: l.dir,
      name: l.endonym,
      file: `${l.code}.json`
    })),
    defaultLocale: DEFAULT_LOCALE,
    langDir: 'messages',

    /**
     * The default language keeps the bare path, every other language gets a
     * prefix: / is English, /ru/ is Russian. Chosen over prefixing everything
     * because every link that exists today keeps working, and x-default has
     * somewhere honest to point.
     */
    strategy: 'prefix_except_default',

    /*
     * No `lazy` option: @nuxtjs/i18n v10 removed it and loads every locale's
     * messages on demand anyway. It sat here as the third silently ignored
     * option in this block, and only surfaced once the project was type-checked.
     */

    /**
     * Translation fallback is NOT configured here — it is `fallbackLocale` in
     * i18n/i18n.config.ts. Two options used to sit at this spot under a
     * comment describing it: `defaultLocaleRouteNameSuffix: 'default'`, which
     * merely repeated the module's own default, and `optimizeTranslationDirective`,
     * which is not a v10 option at all and was ignored. Anyone coming here to
     * fix the fallback would have edited neither of the lines that matter.
     */

    /**
     * No automatic redirect by browser language. Google asks for this
     * explicitly, and it is the behaviour people actually want: someone who
     * deliberately opened the English page should stay on it. A suggestion
     * banner comes later, and it will suggest, not move anyone.
     */
    detectBrowserLanguage: false,

    /** Absolute origin for hreflang and canonical tags. */
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://l2dream.github.io'
  }
})
