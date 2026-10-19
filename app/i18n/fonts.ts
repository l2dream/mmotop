/**
 * Every font the site draws with, and where each is served from.
 *
 * All of them are served by the site itself — modules/fonts.ts writes them out
 * under /fonts/ at build time — so no page asks Google, or anyone else, for
 * anything. The names are the ones the stylesheet and the locale registry
 * already use; READY_LOCALES' `font` field must be one of these.
 */
export const FONT_FAMILIES = [
  'Inter',
  'Noto Sans Armenian',
  'Noto Sans Arabic',
  'Noto Sans Hebrew',
  'Noto Sans SC',
  'Noto Sans JP',
  'Noto Sans KR'
] as const

/** "Noto Sans SC" → "noto-sans-sc": the Fontsource package and the folder. */
export function fontSlug(family: string): string {
  return family.toLowerCase().replace(/ /g, '-')
}

/** Joined onto the app's base URL, which is /mmotop/ on GitHub Pages. */
function fontsPath(base: string, family: string, file: string): string {
  return `${base.replace(/\/?$/, '/')}fonts/${fontSlug(family)}/${file}`
}

/** A script's full font. Shared by the page head and the suggestion banner,
 *  which needs the same face to write a sentence nobody has loaded yet. */
export function fontUrl(base: string, family: string): string {
  return fontsPath(base, family, 'wght.css')
}

/**
 * Exactly the characters each script contributes to the selector. The build
 * cuts a file holding only these glyphs, so opening the selector costs a few
 * kilobytes rather than six families, most of it CJK, to draw eleven glyphs.
 */
export const PICKER_GLYPHS: Record<string, string> = {
  'Noto Sans Armenian': 'ՀԱՅԵՐԵՆ',
  'Noto Sans Arabic': 'العربية',
  'Noto Sans Hebrew': 'עברית',
  'Noto Sans SC': '简体中文',
  'Noto Sans JP': '日本語',
  'Noto Sans KR': '한국어'
}

/**
 * The selector's subsets, minus whichever family this page already loads in
 * full. Both declare @font-face for the same family name; leaving the page's
 * own family out means a page can never have the subset override, for its own
 * glyphs, the face it draws its body text with.
 */
export function pickerFontUrls(base: string, exclude?: string | null): string[] {
  return Object.keys(PICKER_GLYPHS)
    .filter((family) => family !== exclude)
    .map((family) => fontsPath(base, family, 'picker.css'))
}
