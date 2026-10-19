import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import subsetFont from 'subset-font'
import { FONT_FAMILIES, PICKER_GLYPHS, fontSlug } from '../app/i18n/fonts'

/**
 * Serves every font from the site itself, under /fonts/, instead of from
 * Google.
 *
 * Fetching from fonts.googleapis.com hands every visitor's IP address to
 * Google before they have agreed to anything, and in the EU that has already
 * been ruled a GDPR breach (LG München, 2022). The faces are the same Google
 * ones, packaged by Fontsource; this module writes them out at build time:
 *
 *   /fonts/<family>/wght.css    the whole family, sliced by unicode-range as
 *                               Google slices it, so a page downloads only
 *                               the slices whose characters it draws
 *   /fonts/<family>/picker.css  just the glyphs the language selector needs
 *                               to print the family's own language name — the
 *                               local stand-in for Google's `text=` subsets
 *
 * Generated into node_modules/.cache rather than committed: the CJK families
 * alone are over ten megabytes of slices, and they are a build product of
 * versions pinned in package-lock.json.
 */
export default defineNuxtModule({
  meta: { name: 'mmotop-fonts' },

  async setup(_options, nuxt) {
    // nuxt prepare / typecheck build nothing that would serve these.
    if (nuxt.options._prepare) return

    const out = join(nuxt.options.rootDir, 'node_modules/.cache/mmotop-fonts')
    await rm(out, { recursive: true, force: true })
    const require = createRequire(join(nuxt.options.rootDir, 'package.json'))

    for (const family of FONT_FAMILIES) {
      const slug = fontSlug(family)
      const pkg = dirname(require.resolve(`@fontsource-variable/${slug}/package.json`))
      const dir = join(out, 'fonts', slug)
      await mkdir(join(dir, 'files'), { recursive: true })

      // Fontsource names the variable face "<Family> Variable"; the stylesheet
      // and every component ask for plain "<Family>", as they did from Google.
      const css = (await readFile(join(pkg, 'wght.css'), 'utf8'))
        .replaceAll(`'${family} Variable'`, `'${family}'`)
      await writeFile(join(dir, 'wght.css'), css)
      for (const [, file] of css.matchAll(/url\(\.\/files\/([^)]+)\)/g)) {
        await copyFile(join(pkg, 'files', file!), join(dir, 'files', file!))
      }
      // The SIL Open Font License asks for the licence to travel with the fonts.
      await copyFile(join(pkg, 'LICENSE'), join(dir, 'LICENSE'))

      const glyphs = PICKER_GLYPHS[family]
      if (glyphs) await writePickerSubset(css, glyphs, family, pkg, dir)
    }

    nuxt.options.nitro.publicAssets ||= []
    // maxAge only matters on a server; GitHub Pages sets its own caching.
    nuxt.options.nitro.publicAssets.push({ dir: out, maxAge: 60 * 60 * 24 * 365 })
  }
})

/**
 * One tiny file per slice the glyphs fall in, cut down to exactly those
 * glyphs. "简体中文" spans several of Noto Sans SC's hundred slices; fetching
 * the slices whole would pull a few hundred kilobytes to draw four characters.
 */
async function writePickerSubset(css: string, glyphs: string, family: string, pkg: string, dir: string) {
  const wanted = [...new Set(glyphs)].map((c) => c.codePointAt(0)!)
  const covered = new Set<number>()
  const faces: string[] = []

  for (const [, file, ranges] of css.matchAll(/url\(\.\/files\/([^)]+)\)[^;]*;\s*unicode-range:\s*([^;]+);/g)) {
    const inSlice = wanted.filter((cp) => inRanges(cp, ranges!))
    if (inSlice.length === 0) continue
    inSlice.forEach((cp) => covered.add(cp))
    const font = await readFile(join(pkg, 'files', file!))
    const subset = await subsetFont(font, String.fromCodePoint(...inSlice), { targetFormat: 'woff2' })
    const name = `picker-${faces.length}.woff2`
    await writeFile(join(dir, 'files', name), subset)
    faces.push(`@font-face {
  font-family: '${family}';
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url(./files/${name}) format('woff2-variations');
  unicode-range: ${inSlice.map((cp) => `U+${cp.toString(16).toUpperCase()}`).join(',')};
}
`)
  }

  const missing = wanted.filter((cp) => !covered.has(cp))
  if (missing.length) throw new Error(`[fonts] ${family} has no slice for ${String.fromCodePoint(...missing)}`)
  await writeFile(join(dir, 'picker.css'), faces.join('\n'))
}

function inRanges(cp: number, ranges: string) {
  return ranges.split(',').some((r) => {
    const [lo, hi] = r.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16))
    return cp >= lo! && cp <= (hi ?? lo!)
  })
}
