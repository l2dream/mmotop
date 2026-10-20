import { DEFAULT_LOCALE, READY_LOCALES, bcp47 } from './app/i18n/locales'
import { SECTIONS } from './app/data/sections'
import { SERVERS } from './app/data/servers'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  devtools: { enabled: true },

  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      /**
       * interactive-widget=resizes-content: the on-screen keyboard shrinks the
       * page itself rather than a separate visual viewport laid over it.
       *
       * Found with a temporary on-screen readout on an Android phone in
       * Chrome: after the phone had been turned sideways and back, typing in
       * the search left the page scroll at 0 but moved
       * visualViewport.offsetTop down ~18px per key, with the visual viewport
       * reporting a height of 0. Chrome kept panning that zero-height view
       * towards the caret, which it could never reach — the page slid down a
       * step per letter. With the keyboard resizing the page,
       * the visual viewport is the page and has nowhere to pan.
       */
      viewport: 'width=device-width, initial-scale=1, interactive-widget=resizes-content',
      // The site lives under /mmotop/, so the browser's own guess at
      // /favicon.ico (the origin root) finds nothing; the icons are linked.
      // The .ico is for browsers without SVG favicons (Safari), the PNG for
      // an iPhone home-screen shortcut.
      link: [
        { rel: 'icon', href: `${process.env.NUXT_APP_BASE_URL || '/'}favicon.ico`, sizes: '32x32' },
        { rel: 'icon', href: `${process.env.NUXT_APP_BASE_URL || '/'}favicon.svg`, type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: `${process.env.NUXT_APP_BASE_URL || '/'}apple-touch-icon.png` }
      ]
    }
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
      buildYear: new Date().getFullYear(),
      /**
       * The same idea for the date panels: which servers are "coming soon" and
       * which "already started" is worked out against this in the prerendered
       * HTML, then against the visitor's own date once the page is running.
       */
      buildDate: new Date().toISOString().slice(0, 10)
    }
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      /**
       * Every locale's page, listed outright. They were already being
       * generated — but by the i18n module's own route registration, and
       * nothing in the page links to them for the crawler to find (the
       * language links only exist once the selector is opened). Relying on a
       * module's internal behaviour for twenty-five of twenty-six pages meant
       * an upgrade could drop them all silently; now the list comes from the
       * same registry as everything else.
       */
      routes: READY_LOCALES.flatMap((l) => {
        const prefix = l.code === DEFAULT_LOCALE ? '' : `/${l.code}`
        // Each language's section and server pages too. They are linked from
        // its home page, but a section page shows only its first 25 rows, so
        // the crawler would miss servers further down; all are listed outright.
        return [
          ...(prefix ? [prefix] : []),
          ...SECTIONS.map(id => `${prefix}/${id}`),
          ...SERVERS.map(s => `${prefix}/server/${s.id}`)
        ]
      })
    }
  },

  modules: ['@nuxtjs/i18n', '~~/modules/sitemap', '~~/modules/fonts'],

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
