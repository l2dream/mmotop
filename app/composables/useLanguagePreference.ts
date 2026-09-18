/**
 * The two cookies behind the language controls, in one place.
 *
 * They were declared separately in the switcher and the banner, with the same
 * name and the same options written out twice — which works right up until
 * someone changes one of them.
 *
 * What these do NOT do is decide which language a page is in. That lives in
 * the URL: /ru/ is Russian because it is /ru/, not because of anything stored
 * here. We deliberately do not redirect by preference, so someone who chose
 * Russian and later opens / still gets English. The cookie only means the
 * banner can offer Russian by name instead of guessing from Accept-Language.
 * It records an answer so the question is not asked twice; it is not a setting.
 *
 * KNOWN LIMIT, to be fixed when there is a server.
 * A year is requested and a year is what Chrome and Firefox give. Safari does
 * not: its tracking prevention caps any cookie written from JavaScript at
 * seven days, and on a static host written from JavaScript is all we can do —
 * GitHub Pages serves files and sends no Set-Cookie of its own. So the real
 * lifetime today is a year on desktop and a week on every iPhone. The fix is
 * for the server to set it in a response header, which is also the point at
 * which choosing a cookie over localStorage starts paying for itself: a
 * server can read it before the page is built and render in the right
 * language from the first byte. Until then the two are equivalent.
 */
const YEAR = 60 * 60 * 24 * 365

const OPTIONS = {
  maxAge: YEAR,
  sameSite: 'lax',
  path: '/'
} as const

/** The language the visitor picked, by code. Written only on a real click. */
export function useStoredLocale() {
  return useCookie<string | undefined>('mmotop_lang', OPTIONS)
}

/** Set once the suggestion banner is closed, and never unset: asking again
 *  after someone has said no is not a suggestion. */
export function useSuggestionDismissed() {
  return useCookie<string | undefined>('mmotop_lang_hint', OPTIONS)
}
