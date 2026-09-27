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
    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('close', async () => {
        const origin = (process.env.NUXT_PUBLIC_SITE_URL || 'https://l2dream.github.io').replace(/\/$/, '')
        // The deploy sets this to /<repo>/ on Pages; locally it is just /.
        const base = (process.env.NUXT_APP_BASE_URL || '/').replace(/\/$/, '')
        const root = `${origin}${base}`

        // The default locale sits on the bare path, every other one on a prefix.
        const urlFor = (code: string) => (code === DEFAULT_LOCALE ? root || '/' : `${root}/${code}`)

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
      })
    })
  }
})
