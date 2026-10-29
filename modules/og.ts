import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { defineNuxtModule } from 'nuxt/kit'
import subsetFont from 'subset-font'
import { Resvg } from '@resvg/resvg-js'
import { GAMES, chronicleBadge } from '../app/data/games'
import { SERVERS, type Server } from '../app/data/servers'
import { LANDINGS, indexable } from '../app/data/landing'

/**
 * The picture a shared link shows — in Telegram, Discord, a forum — drawn
 * for each page that has something of its own to show: every server, every
 * game, and each chronicle's or rate's page that is offered to search engines
 * (see indexable). Everything else keeps the site's own og-image.jpg.
 *
 * Written after the static build into og/, beside the pages:
 *
 *   og/lineage2.png              a game
 *   og/lineage2/interlude.png    a chronicle's or a rate's page
 *   og/lineage2/la2dream.png     a server
 *
 * One picture per page whatever the language: it carries names, versions,
 * rates and figures, which read the same in all twenty-six, and no words.
 * The page links its picture through ogImagePath in data/og.ts.
 *
 * Drawn as SVG and rendered by resvg, with Inter pinned to the two weights
 * used, made from the same variable font the site serves.
 */

const W = 1200
const H = 630

/** Every glyph the pictures use: names, versions and figures are Latin. */
const GLYPHS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~·'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * How wide a line of text renders, measured by resvg itself with the same
 * fonts, so a chip fits its words exactly. Set once the fonts are made.
 */
let fontFiles: string[] = []
const widths = new Map<string, number>()
function textWidth(text: string, size: number, weight = 500) {
  const key = `${weight}/${size}/${text}`
  let w = widths.get(key)
  if (w === undefined) {
    const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="200"><text x="0" y="150" font-family="Inter" font-weight="${weight}" font-size="${size}">${esc(text)}</text></svg>`
    w = new Resvg(probe, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).getBBox()?.width ?? text.length * size * 0.6
    widths.set(key, w)
  }
  return w
}

const background = `
  <defs>
    <radialGradient id="g1" cx="22%" cy="20%" r="60%"><stop offset="0" stop-color="#5b2fb8" stop-opacity=".42"/><stop offset="1" stop-color="#5b2fb8" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="92%" cy="96%" r="55%"><stop offset="0" stop-color="#0f8f7a" stop-opacity=".28"/><stop offset="1" stop-color="#0f8f7a" stop-opacity="0"/></radialGradient>
    <radialGradient id="g3" cx="88%" cy="8%" r="40%"><stop offset="0" stop-color="#2a5fb8" stop-opacity=".22"/><stop offset="1" stop-color="#2a5fb8" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#ffffff" stroke-opacity=".035" stroke-width="1"/></pattern>
    <linearGradient id="logo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9b5cff"/><stop offset="1" stop-color="#6d28d9"/></linearGradient>
    <linearGradient id="vote" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd84d"/><stop offset="1" stop-color="#f5a623"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a0c20"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>
  <rect width="${W}" height="${H}" fill="url(#g3)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect x="96" y="72" width="64" height="64" rx="16" fill="url(#logo)"/>
  <text x="128" y="117" text-anchor="middle" font-family="Inter" font-weight="800" font-size="36" fill="#fff">M</text>
  <text x="180" y="117" font-family="Inter" font-weight="800" font-size="38" letter-spacing="-1" fill="#fff">MMOTOP</text>`

/** A row of chips from the left margin, as many as fit on one line. */
function chips(items: { text: string, accent?: 'gold' | 'violet' }[], y: number) {
  let x = 96
  const out: string[] = []
  for (const item of items) {
    const w = textWidth(item.text, 30, item.accent === 'gold' ? 700 : 500) + (item.accent === 'gold' ? 78 : 48)
    if (x + w > W - 96) break
    const fill = item.accent === 'violet' ? '#5b2fb8' : '#151a33'
    const stroke = item.accent === 'violet' ? '#9b6bff' : '#3a3f66'
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="60" rx="14" fill="${fill}" fill-opacity=".85" stroke="${stroke}" stroke-opacity=".8"/>`)
    if (item.accent === 'gold') {
      out.push(`<path transform="translate(${x + 22} ${y + 17}) scale(1.15)" d="M12 4 L20 12 H15.5 V19 H8.5 V12 H4 Z" fill="url(#vote)"/>`)
      out.push(`<text x="${x + 54}" y="${y + 41}" font-family="Inter" font-weight="700" font-size="30" fill="#ffd84d">${esc(item.text)}</text>`)
    } else {
      out.push(`<text x="${x + 24}" y="${y + 41}" font-family="Inter" font-weight="500" font-size="30" fill="#e4e6f4">${esc(item.text)}</text>`)
    }
    x += w + 14
  }
  return out.join('\n')
}

/** A heading as large as fits the width left of `from`. */
function heading(text: string, x: number, y: number, max: number, width: number) {
  let size = max
  while (size > 48 && textWidth(text, size, 800) > width) size -= 2
  return `<text x="${x}" y="${y}" font-family="Inter" font-weight="800" font-size="${size}" letter-spacing="-1.5" fill="#fff">${esc(text)}</text>`
}

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${background}${body}</svg>`

const byVotes = [...SERVERS].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
const gameName = (id: string) => GAMES.find((g) => g.id === id)?.name ?? id

function serverPicture(s: Server) {
  const rank = byVotes.indexOf(s) + 1
  const medal = ['#f5c542', '#d6dbe6', '#e0915a'][rank - 1]
  const rankChip = rank <= 10
    ? `<rect x="${W - 96 - 130}" y="72" width="130" height="64" rx="32" fill="#151a33" stroke="${medal ?? '#3a3f66'}" stroke-width="2"/>
       <text x="${W - 96 - 65}" y="116" text-anchor="middle" font-family="Inter" font-weight="800" font-size="32" fill="${medal ?? '#e4e6f4'}">#${rank}</text>`
    : ''
  const badge = chronicleBadge(s.game, s.chronicle)
  return svg(`
    ${rankChip}
    <rect x="96" y="214" width="136" height="136" rx="26" fill="#161b30" stroke="#3a3f66" stroke-width="2"/>
    <text x="164" y="${badge.length > 2 ? 296 : 300}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${badge.length > 2 ? 40 : 48}" fill="#e8eaf6">${esc(badge)}</text>
    ${heading(s.name, 268, 292, 96, W - 96 - 268)}
    <text x="270" y="344" font-family="Inter" font-weight="500" font-size="40" fill="#b9bdd0">${esc(gameName(s.game))}</text>
    ${chips([
      { text: s.chronicle, accent: 'violet' },
      ...(s.rate == null ? [] : [{ text: `x${s.rate}` }]),
      { text: String(s.votes), accent: 'gold' as const }
    ], 440)}`)
}

function gamePicture(gameId: string) {
  const servers = SERVERS.filter((s) => s.game === gameId)
  const g = GAMES.find((x) => x.id === gameId)!
  const versions = g.chronicles.filter((c) => servers.some((s) => s.chronicle === c.name)).map((c) => ({ text: c.name }))
  return svg(`
    ${heading(g.name, 96, 330, 120, W - 192)}
    ${chips(versions, 440)}`)
}

function landingPicture(l: (typeof LANDINGS)[number]) {
  const servers = byVotes.filter((s) => s.game === l.game && (l.chronicle ? s.chronicle === l.chronicle : s.rate === l.rate))
  return svg(`
    <text x="98" y="250" font-family="Inter" font-weight="500" font-size="44" fill="#b9bdd0">${esc(gameName(l.game))}</text>
    ${heading(l.chronicle ?? `x${l.rate}`, 96, 358, 120, W - 192)}
    ${chips(servers.map((s) => ({ text: s.name })), 440)}`)
}

export default defineNuxtModule({
  meta: { name: 'mmotop-og' },

  setup(_options, nuxt) {
    // As with the sitemap: not for the dev server, nor for prepare/typecheck.
    if (nuxt.options.dev || nuxt.options._prepare) return

    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('close', async () => {
        const out = join(nitro.options.output.publicDir, 'og')
        const require = createRequire(import.meta.url)
        const variable = await readFile(require.resolve('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'))
        const fontDir = join(tmpdir(), 'mmotop-og-fonts')
        await mkdir(fontDir, { recursive: true })
        fontFiles = []
        for (const wght of [500, 700, 800]) {
          const file = join(fontDir, `inter-${wght}.ttf`)
          await writeFile(file, await subsetFont(variable, GLYPHS, { targetFormat: 'sfnt', variationAxes: { wght } }))
          fontFiles.push(file)
        }

        const pictures: [string, string][] = [
          ...SERVERS.map((s): [string, string] => [`${s.game}/${s.id}.png`, serverPicture(s)]),
          ...GAMES.filter((g) => SERVERS.some((s) => s.game === g.id)).map((g): [string, string] => [`${g.id}.png`, gamePicture(g.id)]),
          ...LANDINGS.filter(indexable).map((l): [string, string] => [`${l.game}/${l.slug}.png`, landingPicture(l)])
        ]
        for (const [path, body] of pictures) {
          const png = new Resvg(body, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).render().asPng()
          const file = join(out, path)
          await mkdir(dirname(file), { recursive: true })
          await writeFile(file, png)
        }
        console.log(`[og] ${pictures.length} link pictures written to og/`)
      })
    })
  }
})
