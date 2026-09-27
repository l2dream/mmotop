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

    /** One file per language, fetched when that language is opened. At
     *  twenty-six languages, bundling them all would be absurd. */
    lazy: true,

    /** Anything not yet translated shows the English string rather than the
     *  key. A half-translated page beats `panels.top` on screen. */
    defaultLocaleRouteNameSuffix: 'default',
    bundle: { optimizeTranslationDirective: false },

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
