import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { DEFAULT_LOCALE, READY_LOCALES, bcp47 } from '../app/i18n/locales'

/**
 * Writes sitemap.xml and appends its address to robots.txt after the static
 * build, listing all twenty-six locale URLs with their alternates.
 *
 * This is not the usual "nice to have" sitemap. The links to the other
 * twenty-five languages live inside the selector popup, which is `v-if="open"`
 * — so no prerendered file contains a single anchor pointing at /de/ or /ko/.
 * Nitro's crawlLinks finds nothing; the routes exist only because the i18n
 * module registers them. Until now the hreflang tags in the head were the
 * only path a crawler had to any language but the one it landed on, and
 * hanging twenty-six pages off one channel is thin.
 *
 * Built from the registry, like everything else, so it cannot list a language
 * the site does not have or miss one it does.
 */
export default defineNuxtModule({
  meta: { name: 'mmotop-sitemap' },

  setup(_options, nuxt) {
    // The dev server calls nuxt.close() on shutdown and on every config
    // change, which would otherwise rewrite robots.txt and log a production
    // sitemap each time you restart.
    //
    // Nor during `nuxt prepare` / `nuxt typecheck`, which set _prepare and
    // still initialise Nitro — the type-check step in CI was writing a sitemap
    // and robots.txt into .output before anything had been built.
    if (nuxt.options.dev || nuxt.options._prepare) return

    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('close', async () => {
        const origin = (process.env.NUXT_PUBLIC_SITE_URL || 'https://l2dream.github.io').replace(/\/$/, '')
        /**
         * The deploy sets this to /<repo>/ on Pages; locally it is just /.
         * Normalised at both ends: the trailing slash was already stripped,
         * but a value without a leading one ("mmotop") silently produced
         * "https://l2dream.github.iommotop/de" in every URL, and the build
         * still reported success.
         */
        const raw = process.env.NUXT_APP_BASE_URL || '/'
        const base = raw === '/' ? '' : `/${raw.replace(/^\/+|\/+$/g, '')}`
        // Belt and braces only: Nuxt's own prerender already dies on a base
        // path with no leading slash, so this normalisation is never the thing
        // that saves the build — it just means the sitemap cannot be the one
        // component quietly emitting "https://example.commmotop/de".
        const root = `${origin}${base}`

        // The default locale sits on the bare path, every other one on a prefix.
        // With a trailing slash: each page is a directory on Pages, and the
        // address without one answers with a 301. A sitemap should list the
        // URL a crawler lands on, not the one it is redirected away from.
        const urlFor = (code: string) => (code === DEFAULT_LOCALE ? `${root}/` : `${root}/${code}/`)

        const alternates = [
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(DEFAULT_LOCALE)}"/>`,
          ...READY_LOCALES.map(
            l => `    <xhtml:link rel="alternate" hreflang="${bcp47(l.code)}" href="${urlFor(l.code)}"/>`
          )
        ].join('\n')

        // Every entry carries the full alternate set, which is what makes the
        // cluster reciprocal — the half of hreflang that is easy to get wrong.
        const entries = READY_LOCALES.map(l => `  <url>
    <loc>${urlFor(l.code)}</loc>
${alternates}
    <changefreq>daily</changefreq>
    <priority>${l.code === DEFAULT_LOCALE ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`

        const outDir = nitro.options.output.publicDir
        await writeFile(join(outDir, 'sitemap.xml'), xml, 'utf8')
        await writeFile(
          join(outDir, 'robots.txt'),
          `User-agent: *\nAllow: /\n\nSitemap: ${root}/sitemap.xml\n`,
          'utf8'
        )
        console.log(`[sitemap] ${READY_LOCALES.length} URLs → ${root}/sitemap.xml`)

        /**
         * robots.txt is only read at the origin root. On a GitHub project page
         * the site lives under /<repo>/, so the file we just wrote sits at
         * /<repo>/robots.txt where no crawler will look for it, and the
         * Sitemap line in it is never seen. The file is still written — it
         * becomes correct the moment a custom domain puts the site at the root
         * — but pretending the discovery hole is closed would be worse than
         * saying so at build time.
         */
        if (base !== '') {
          console.warn(
            `[sitemap] base path is "${base}", so robots.txt lands at ${root}/robots.txt `
            + 'and will not be read — crawlers only fetch it from the origin root. '
            + `Submit ${root}/sitemap.xml in Search Console, or move the site to a custom domain.`
          )
        }
      })
    })
  }
})
