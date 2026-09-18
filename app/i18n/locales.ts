/**
 * The single source of truth for which languages exist.
 *
 * Everything downstream reads this list rather than repeating it: the URL
 * prefixes, the hreflang tags, the selector popup, the search index and the
 * decision about which font file a visitor has to download. Adding a language
 * should mean adding one entry here and one message file — nothing else.
 *
 * A note on the names. Each `endonym` is the language's name in its own
 * language and its own script, because that is the only form a visitor who
 * does not read our interface can recognise. Several entries on the old
 * la2dream list were nationalities or countries rather than languages
 * (LIETUVOS "of Lithuania", TÜRK "a Turk", EESTLANE "an Estonian",
 * AZƏRBAYCAN the country, ČEŠKA which is Croatian for "a Czech woman") and
 * are corrected here. AMERICAN and BRASILEIRO were not languages at all but
 * regional variants of English and Portuguese, and appear as such.
 */

export type Script = 'latin' | 'cyrillic' | 'greek' | 'armenian' | 'arabic' | 'hebrew' | 'east-asian'

export interface Locale {
  /** Goes into the URL: /de/, /pt-br/. Also the <html lang> value. */
  code: string
  /** The language's own name, in its own script. Shown in the selector. */
  endonym: string
  /** English name — never displayed, but indexed so search works either way. */
  name: string
  /**
   * Two letters in the chip beside the name. A plain language gets its own
   * code; a regional variant gets the region's, so every chip stays exactly
   * two characters wide and the column keeps its rhythm.
   */
  chip: string
  script: Script
  /**
   * Writing direction. Read twice: once to set `dir` on <html> for the whole
   * page, and once on the selector row itself, so an Arabic or Hebrew name
   * lays out correctly even while sitting in a left-to-right list.
   */
  dir: 'ltr' | 'rtl'
  /**
   * Extra font family this locale needs on top of Inter, or null when Inter
   * already covers the script. These files are megabytes apiece, so they load
   * for the locale that needs them and for nobody else.
   */
  font: string | null
}

/**
 * Ordered by script, then alphabetically by endonym inside each script.
 *
 * Grouping beats a flat alphabet at this length: twenty-four rows sorted by
 * English name scatter 한국어 somewhere under "K", where nobody who reads
 * Korean would look for it. Sorted by script, a visitor finds their own
 * writing system by shape before reading a single word.
 */
export const LOCALES: Locale[] = [
  // Latin — Inter covers all of these.
  { code: 'az',    endonym: 'AZƏRBAYCANCA',       name: 'Azerbaijani',            chip: 'AZ', script: 'latin', dir: 'ltr', font: null },
  { code: 'cs',    endonym: 'ČEŠTINA',            name: 'Czech',                  chip: 'CS', script: 'latin', dir: 'ltr', font: null },
  { code: 'da',    endonym: 'DANSK',              name: 'Danish',                 chip: 'DA', script: 'latin', dir: 'ltr', font: null },
  { code: 'de',    endonym: 'DEUTSCH',            name: 'German',                 chip: 'DE', script: 'latin', dir: 'ltr', font: null },
  { code: 'et',    endonym: 'EESTI',              name: 'Estonian',               chip: 'ET', script: 'latin', dir: 'ltr', font: null },
  { code: 'en',    endonym: 'ENGLISH',            name: 'English',                chip: 'EN', script: 'latin', dir: 'ltr', font: null },
  { code: 'en-us', endonym: 'ENGLISH (US)',       name: 'English (United States)', chip: 'US', script: 'latin', dir: 'ltr', font: null },
  { code: 'es',    endonym: 'ESPAÑOL',            name: 'Spanish',                chip: 'ES', script: 'latin', dir: 'ltr', font: null },
  { code: 'fr',    endonym: 'FRANÇAIS',           name: 'French',                 chip: 'FR', script: 'latin', dir: 'ltr', font: null },
  { code: 'lv',    endonym: 'LATVIEŠU',           name: 'Latvian',                chip: 'LV', script: 'latin', dir: 'ltr', font: null },
  { code: 'lt',    endonym: 'LIETUVIŲ',           name: 'Lithuanian',             chip: 'LT', script: 'latin', dir: 'ltr', font: null },
  // 'no' rather than 'nb': NORSK is what the reader expects to see, and /no/
  // is what they expect in the address bar.
  { code: 'no',    endonym: 'NORSK',              name: 'Norwegian',              chip: 'NO', script: 'latin', dir: 'ltr', font: null },
  { code: 'pl',    endonym: 'POLSKI',             name: 'Polish',                 chip: 'PL', script: 'latin', dir: 'ltr', font: null },
  { code: 'pt',    endonym: 'PORTUGUÊS',          name: 'Portuguese',             chip: 'PT', script: 'latin', dir: 'ltr', font: null },
  { code: 'pt-br', endonym: 'PORTUGUÊS (BRASIL)', name: 'Portuguese (Brazil)',    chip: 'BR', script: 'latin', dir: 'ltr', font: null },
  { code: 'sv',    endonym: 'SVENSKA',            name: 'Swedish',                chip: 'SV', script: 'latin', dir: 'ltr', font: null },
  { code: 'tr',    endonym: 'TÜRKÇE',             name: 'Turkish',                chip: 'TR', script: 'latin', dir: 'ltr', font: null },

  // Cyrillic — Inter covers these too.
  { code: 'ru',    endonym: 'РУССКИЙ',            name: 'Russian',                chip: 'RU', script: 'cyrillic', dir: 'ltr', font: null },
  { code: 'uk',    endonym: 'УКРАЇНСЬКА',         name: 'Ukrainian',              chip: 'UK', script: 'cyrillic', dir: 'ltr', font: null },

  // Greek — Inter covers it. Uppercase Greek drops its accents, so this is
  // ΕΛΛΗΝΙΚΑ and not ΕΛΛΗΝΙΚΆ.
  { code: 'el',    endonym: 'ΕΛΛΗΝΙΚΑ',           name: 'Greek',                  chip: 'EL', script: 'greek', dir: 'ltr', font: null },

  // Armenian — Inter has no Armenian. The old list spelled this with a Latin
  // H in front of Armenian letters, which looks fine until the font changes.
  { code: 'hy',    endonym: 'ՀԱՅԵՐԵՆ',            name: 'Armenian',               chip: 'HY', script: 'armenian', dir: 'ltr', font: 'Noto Sans Armenian' },

  // Right to left. The stylesheet already mirrors on `dir="rtl"`, so these two
  // need no layout of their own — only their fonts, which Inter does not have.
  { code: 'ar',    endonym: 'العربية',              name: 'Arabic',                 chip: 'AR', script: 'arabic', dir: 'rtl', font: 'Noto Sans Arabic' },
  { code: 'he',    endonym: 'עברית',                name: 'Hebrew',                 chip: 'HE', script: 'hebrew', dir: 'rtl', font: 'Noto Sans Hebrew' },

  // East Asian — each needs its own multi-megabyte font.
  // Traditional Chinese would join as 'zh-hant' / 繁體中文 if the traffic asks
  // for it; it is a different text and a different font, not a toggle.
  { code: 'zh',    endonym: '简体中文',              name: 'Chinese (Simplified)',   chip: 'ZH', script: 'east-asian', dir: 'ltr', font: 'Noto Sans SC' },
  { code: 'ja',    endonym: '日本語',               name: 'Japanese',               chip: 'JA', script: 'east-asian', dir: 'ltr', font: 'Noto Sans JP' },
  { code: 'ko',    endonym: '한국어',               name: 'Korean',                 chip: 'KO', script: 'east-asian', dir: 'ltr', font: 'Noto Sans KR' }
]

/** What `/` serves, and what a missing translation falls back to. */
export const DEFAULT_LOCALE = 'en'

/**
 * Which of the twenty-six actually have a message file today.
 *
 * The list above is the plan; this is the state. They are kept apart on
 * purpose: a language only becomes a real URL, a real hreflang tag and a real
 * row in the selector once there is something to read there. Publishing
 * twenty-six addresses that all serve English would earn us twenty-six pages
 * of duplicate content and a selector that lies to the person clicking it.
 *
 * Translating a language means adding its code here and dropping in the file.
 */
export const READY_CODES = LOCALES.map(l => l.code)

export const READY_LOCALES: Locale[] = LOCALES.filter(l => READY_CODES.includes(l.code))

/** Headings for the selector, in the order the groups appear. */
export const SCRIPT_ORDER: Script[] = ['latin', 'cyrillic', 'greek', 'armenian', 'arabic', 'hebrew', 'east-asian']

export const SCRIPT_LABELS: Record<Script, string> = {
  latin: 'Latin',
  cyrillic: 'Cyrillic',
  greek: 'Greek',
  armenian: 'Armenian',
  arabic: 'Arabic',
  hebrew: 'Hebrew',
  'east-asian': 'East Asian'
}

/** True once any right-to-left language exists, which is what the mirrored
 *  stylesheet and the <html dir> switch were built for. */
export const HAS_RTL = LOCALES.some(l => l.dir === 'rtl')

export function localeByCode(code: string): Locale | undefined {
  return LOCALES.find(l => l.code === code)
}

/**
 * The BCP 47 form, for <html lang> and hreflang. URLs stay lowercase because
 * addresses are typed and shared by people; tags are read by machines that
 * expect PORTUGUÊS (BRASIL) at /pt-br/ to announce itself as "pt-BR".
 */
export function bcp47(code: string): string {
  const [language, region] = code.split('-')
  return region ? `${language}-${region.toUpperCase()}` : language!
}

/**
 * The selector's groups, built from the list so the two cannot drift apart.
 * Defaults to what is translated; pass LOCALES to see the whole plan.
 */
export function groupedLocales(from: Locale[] = READY_LOCALES): { script: Script, label: string, locales: Locale[] }[] {
  return SCRIPT_ORDER
    .map(script => ({
      script,
      label: SCRIPT_LABELS[script],
      locales: from.filter(l => l.script === script)
    }))
    .filter(group => group.locales.length > 0)
}

/**
 * Matches a typed query against the endonym, the English name and the code, so
 * the list can be narrowed without switching keyboard layouts — "korean",
 * "한국", and "ko" all find the same row.
 */
export function matchesQuery(locale: Locale, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return locale.endonym.toLowerCase().includes(q)
    || locale.name.toLowerCase().includes(q)
    || locale.code.toLowerCase().includes(q)
    || locale.chip.toLowerCase().includes(q)
}
