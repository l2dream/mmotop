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
   * The Open Graph locale, which insists on language_TERRITORY and will drop
   * the tag entirely for a bare "ko" or "ru". Held here rather than derived,
   * because there is no deriving Portugal from "pt" — someone has to choose.
   *
   * Note en → en_GB rather than en_US: en-us exists separately and writes its
   * dates month-first, so the generic English here is the day-first,
   * international one, and en_GB is the honest label for that.
   */
  ogLocale: string
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
  { code: 'az',    endonym: 'AZƏRBAYCANCA',       name: 'Azerbaijani',            chip: 'AZ', ogLocale: 'az_AZ', script: 'latin', dir: 'ltr', font: null },
  { code: 'cs',    endonym: 'ČEŠTINA',            name: 'Czech',                  chip: 'CS', ogLocale: 'cs_CZ', script: 'latin', dir: 'ltr', font: null },
  { code: 'da',    endonym: 'DANSK',              name: 'Danish',                 chip: 'DA', ogLocale: 'da_DK', script: 'latin', dir: 'ltr', font: null },
  { code: 'de',    endonym: 'DEUTSCH',            name: 'German',                 chip: 'DE', ogLocale: 'de_DE', script: 'latin', dir: 'ltr', font: null },
  { code: 'et',    endonym: 'EESTI',              name: 'Estonian',               chip: 'ET', ogLocale: 'et_EE', script: 'latin', dir: 'ltr', font: null },
  { code: 'en',    endonym: 'ENGLISH',            name: 'English',                chip: 'EN', ogLocale: 'en_GB', script: 'latin', dir: 'ltr', font: null },
  { code: 'en-us', endonym: 'ENGLISH (US)',       name: 'English (United States)', chip: 'US', ogLocale: 'en_US', script: 'latin', dir: 'ltr', font: null },
  { code: 'es',    endonym: 'ESPAÑOL',            name: 'Spanish',                chip: 'ES', ogLocale: 'es_ES', script: 'latin', dir: 'ltr', font: null },
  { code: 'fr',    endonym: 'FRANÇAIS',           name: 'French',                 chip: 'FR', ogLocale: 'fr_FR', script: 'latin', dir: 'ltr', font: null },
  { code: 'lv',    endonym: 'LATVIEŠU',           name: 'Latvian',                chip: 'LV', ogLocale: 'lv_LV', script: 'latin', dir: 'ltr', font: null },
  { code: 'lt',    endonym: 'LIETUVIŲ',           name: 'Lithuanian',             chip: 'LT', ogLocale: 'lt_LT', script: 'latin', dir: 'ltr', font: null },
  // 'no' rather than 'nb': NORSK is what the reader expects to see, and /no/
  // is what they expect in the address bar.
  { code: 'no',    endonym: 'NORSK',              name: 'Norwegian',              chip: 'NO', ogLocale: 'nb_NO', script: 'latin', dir: 'ltr', font: null },
  { code: 'pl',    endonym: 'POLSKI',             name: 'Polish',                 chip: 'PL', ogLocale: 'pl_PL', script: 'latin', dir: 'ltr', font: null },
  { code: 'pt',    endonym: 'PORTUGUÊS',          name: 'Portuguese',             chip: 'PT', ogLocale: 'pt_PT', script: 'latin', dir: 'ltr', font: null },
  { code: 'pt-br', endonym: 'PORTUGUÊS (BRASIL)', name: 'Portuguese (Brazil)',    chip: 'BR', ogLocale: 'pt_BR', script: 'latin', dir: 'ltr', font: null },
  { code: 'sv',    endonym: 'SVENSKA',            name: 'Swedish',                chip: 'SV', ogLocale: 'sv_SE', script: 'latin', dir: 'ltr', font: null },
  { code: 'tr',    endonym: 'TÜRKÇE',             name: 'Turkish',                chip: 'TR', ogLocale: 'tr_TR', script: 'latin', dir: 'ltr', font: null },

  // Cyrillic — Inter covers these too.
  { code: 'ru',    endonym: 'РУССКИЙ',            name: 'Russian',                chip: 'RU', ogLocale: 'ru_RU', script: 'cyrillic', dir: 'ltr', font: null },
  { code: 'uk',    endonym: 'УКРАЇНСЬКА',         name: 'Ukrainian',              chip: 'UK', ogLocale: 'uk_UA', script: 'cyrillic', dir: 'ltr', font: null },

  // Greek — Inter covers it. Uppercase Greek drops its accents, so this is
  // ΕΛΛΗΝΙΚΑ and not ΕΛΛΗΝΙΚΆ.
  { code: 'el',    endonym: 'ΕΛΛΗΝΙΚΑ',           name: 'Greek',                  chip: 'EL', ogLocale: 'el_GR', script: 'greek', dir: 'ltr', font: null },

  // Armenian — Inter has no Armenian. The old list spelled this with a Latin
  // H in front of Armenian letters, which looks fine until the font changes.
  { code: 'hy',    endonym: 'ՀԱՅԵՐԵՆ',            name: 'Armenian',               chip: 'HY', ogLocale: 'hy_AM', script: 'armenian', dir: 'ltr', font: 'Noto Sans Armenian' },

  // Right to left. The stylesheet already mirrors on `dir="rtl"`, so these two
  // need no layout of their own — only their fonts, which Inter does not have.
  { code: 'ar',    endonym: 'العربية',              name: 'Arabic',                 chip: 'AR', ogLocale: 'ar_AR', script: 'arabic', dir: 'rtl', font: 'Noto Sans Arabic' },
  { code: 'he',    endonym: 'עברית',                name: 'Hebrew',                 chip: 'HE', ogLocale: 'he_IL', script: 'hebrew', dir: 'rtl', font: 'Noto Sans Hebrew' },

  // East Asian — each needs its own multi-megabyte font.
  // Traditional Chinese would join as 'zh-hant' / 繁體中文 if the traffic asks
  // for it; it is a different text and a different font, not a toggle.
  { code: 'zh',    endonym: '简体中文',              name: 'Chinese (Simplified)',   chip: 'ZH', ogLocale: 'zh_CN', script: 'east-asian', dir: 'ltr', font: 'Noto Sans SC' },
  { code: 'ja',    endonym: '日本語',               name: 'Japanese',               chip: 'JA', ogLocale: 'ja_JP', script: 'east-asian', dir: 'ltr', font: 'Noto Sans JP' },
  { code: 'ko',    endonym: '한국어',               name: 'Korean',                 chip: 'KO', ogLocale: 'ko_KR', script: 'east-asian', dir: 'ltr', font: 'Noto Sans KR' }
]

/** What `/` serves, and what a missing translation falls back to. */
export const DEFAULT_LOCALE = 'en'

/**
 * Which of the languages above actually have a message file today.
 *
 * Written out by hand, and that is the whole point. It was briefly
 * `LOCALES.map(l => l.code)`, which made the filter below a no-op and turned
 * the paragraph you are reading into a promise the code did not keep: a
 * twenty-seventh entry in LOCALES would have been routed, put in the hreflang
 * cluster on every page and listed in the selector before anyone had written
 * a word of it.
 *
 * The list above is the plan; this is the state. A language becomes a real
 * URL, a real hreflang tag and a real row in the selector only once there is
 * something to read there. Adding one means a line here and a file in
 * i18n/messages — and the check below fails the build if you do one without
 * the other.
 */
export const READY_CODES = [
  'az', 'cs', 'da', 'de', 'et', 'en', 'en-us', 'es', 'fr', 'lv', 'lt', 'no',
  'pl', 'pt', 'pt-br', 'sv', 'tr', 'ru', 'uk', 'el', 'hy', 'ar', 'he',
  'zh', 'ja', 'ko'
]

export const READY_LOCALES: Locale[] = LOCALES.filter(l => READY_CODES.includes(l.code))

/** A code in READY_CODES that names no language is the other way to get this
 *  wrong, and it fails quietly — the locale simply never appears. */
const UNKNOWN = READY_CODES.filter(code => !LOCALES.some(l => l.code === code))
if (UNKNOWN.length > 0) {
  throw new Error(`READY_CODES names languages that do not exist: ${UNKNOWN.join(', ')}`)
}

/** Headings for the selector, in the order the groups appear. */
export const SCRIPT_ORDER: Script[] = ['latin', 'cyrillic', 'greek', 'armenian', 'arabic', 'hebrew', 'east-asian']

/**
 * The message key each script group's heading is translated under.
 *
 * These used to be English strings rendered straight into the selector, which
 * meant LATIN / CYRILLIC / ARABIC in English on all twenty-six locales — in
 * the one control built specifically for people who cannot read the interface
 * around it.
 */
export const SCRIPT_LABEL_KEYS: Record<Script, string> = {
  latin: 'scripts.latin',
  cyrillic: 'scripts.cyrillic',
  greek: 'scripts.greek',
  armenian: 'scripts.armenian',
  arabic: 'scripts.arabic',
  hebrew: 'scripts.hebrew',
  'east-asian': 'scripts.eastAsian'
}


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

export interface LocaleGroup {
  script: Script
  labelKey: string
  locales: Locale[]
}

/**
 * The selector's groups, built from the list so the two cannot drift apart.
 *
 * The selector used to rebuild this inline — which is exactly the drift this
 * docblock claimed to prevent, happening inside the file that claimed it. It
 * takes the filter as an argument now, which is the only reason the copy
 * existed.
 */
export function groupedLocales(
  keep: (locale: Locale) => boolean = () => true,
  from: Locale[] = READY_LOCALES
): LocaleGroup[] {
  return SCRIPT_ORDER
    .map(script => ({
      script,
      labelKey: SCRIPT_LABEL_KEYS[script],
      locales: from.filter(l => l.script === script && keep(l))
    }))
    .filter(group => group.locales.length > 0)
}

/**
 * Letters that carry no combining mark to strip, so NFD leaves them alone.
 * Each is a letter someone typing on a foreign keyboard will replace with the
 * one on the right.
 */
const STANDALONE: Record<string, string> = {
  'ə': 'e', 'ł': 'l', 'đ': 'd', 'ø': 'o', 'æ': 'ae', 'œ': 'oe',
  'ß': 'ss', 'ı': 'i', 'ð': 'd', 'þ': 'th', 'ħ': 'h', 'ŋ': 'n'
}

/**
 * Lowercases and drops diacritics, so a query typed on a keyboard that has
 * none still matches.
 *
 * This is the part that makes the search do what it was built for. Without it
 * "espanol" found nothing at all, because the endonym is ESPAÑOL — and the
 * person typing without the tilde is exactly the person who most needs to find
 * their own language in a list of twenty-six. Same for turkce, cestina,
 * latviesu and azerbaycanca.
 */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/[əłđøæœßıðþħŋ]/g, ch => STANDALONE[ch] ?? ch)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/**
 * Matches a typed query against the endonym, the English name and the code, so
 * the list can be narrowed without switching keyboard layouts — "korean",
 * "한국", "ko" and "espanol" all find their row.
 */
export function matchesQuery(locale: Locale, query: string): boolean {
  const q = fold(query.trim())
  if (!q) return true
  return fold(locale.endonym).includes(q)
    || fold(locale.name).includes(q)
    || fold(locale.code).includes(q)
    || fold(locale.chip).includes(q)
}
