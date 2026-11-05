import type { Server } from '~/data/servers'
import { bcp47 } from '~/i18n/locales'

/**
 * A server in a few plain sentences: what it is, when it opens, how it
 * stands. Shown under its name on its page (ServerDetail), and in the account
 * form as what the page will say when the owner writes no description of
 * their own.
 *
 * The same facts as the boxes on the page, but as text — a page of figures
 * and labels alone read to search engines as next to empty, and they set
 * several server pages aside as soft 404s. So it is always there; an owner's
 * description comes in addition, below it.
 */

/** Scripts that run sentences together, with no space after the full stop. */
const NO_SPACES = new Set(['ja', 'zh'])

/**
 * Languages whose dates Intl cannot be trusted with in the browser: Chrome
 * ships no Armenian date data at all and printed "November 20, 2025", and for
 * Azerbaijani it has no month names and printed "2025 M11 20". These use the
 * site's own day-and-month, as in the lists, with the year after it. A fixed
 * list rather than a check at run time, so the prerendered page — built in
 * Node, which does have the data — and the browser always agree.
 */
const OWN_DATE_FORMAT = new Set(['hy', 'az'])

/**
 * What a rate means to a player, in the filter's own tiers (Dashboard's
 * rateTiers): up to x10, x10–x100, x100–x1000, above.
 */
function rateKind(rate: number) {
  if (rate <= 10) return 'rateLow'
  if (rate <= 100) return 'rateMid'
  if (rate <= 1000) return 'rateHigh'
  return 'rateMax'
}

/** Spaces that do not break. */
const keep = (text: string) => text.replace(/ /g, ' ')

export function useServerAbout() {
  const { locale, t } = useI18n()
  const { serverSubtitle, rateLabel, formatDayMonth } = useServerFormat()

  /**
   * The full date, year included, in the reader's own form: "20 November 2025",
   * "November 20, 2025", "2025年11月20日". The lists use a short day-and-month
   * to stay narrow; here there is room to say it properly. Plain "en" would
   * format the American way, and the site's English is British.
   */
  function fullDate(iso: string) {
    if (OWN_DATE_FORMAT.has(locale.value)) return `${keep(formatDayMonth(iso))} ${iso.slice(0, 4)}`
    const tag = locale.value === 'en' ? 'en-GB' : bcp47(locale.value)
    // Every kind of space Intl puts in a date made plain first: Node's ICU
    // writes "2025 г." with a narrow no-break space (U+202F) and Chrome's with
    // a no-break one (U+00A0), so the prerendered page and the browser's
    // disagreed and Vue reported a hydration mismatch on every Russian server
    // page. The spaces are held or freed below, the same way in both.
    const parts = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .formatToParts(new Date(`${iso}T00:00:00Z`))
      .map((p) => ({ ...p, value: p.value.replace(/[\u00a0\u202f\u2009]/g, ' ') }))
    // A narrow card may break the date in one place only: between the day and
    // month and the year, so "12 January" stays together over "2025" rather
    // than "12" over "January 2025", and "20 ноября / 2025 г." never leaves
    // the "г." alone. Every other space is held. Where the year comes first
    // (2025년 1월 12일) the break is after it instead. Words that go with the
    // year go with it too: "12 de enero / de 2025", "2025 m. / sausio 12 d.".
    const year = parts.findIndex((p) => p.type === 'year')
    const before = year > 0
    const free = before ? year - 1 : year + 1
    return parts.map((p, i) => {
      if (i !== free) return keep(p.value)
      const at = before ? p.value.indexOf(' ') : p.value.lastIndexOf(' ')
      return at < 0 ? p.value : keep(p.value.slice(0, at)) + ' ' + keep(p.value.slice(at + 1))
    }).join('')
  }

  /**
   * The sentences. `rank` adds the one about votes, which a server not yet
   * listed (the account form's preview) has nothing to say in; `game` names a
   * game the site does not list yet.
   *
   * Besides the facts, what the rate means to a player — so that, with the
   * same template, the text still says something of this server in
   * particular. (A count of servers of the same game and chronicle was here
   * too; it repeated the first sentence's words and the owner had it
   * removed.) `brief` leaves it out: the account form's preview, where the
   * owner asked for the facts alone.
   */
  function aboutText(s: Server, today: string, options: { rank?: number, game?: string, brief?: boolean } = {}) {
    const kind = { name: s.name, game: options.game ?? serverSubtitle(s), chronicle: s.chronicle, rate: rateLabel(s) }
    return [
      t(s.rate == null ? 'server.about.noRate' : 'server.about.rate', kind),
      // Some dates end in a full stop of their own ("20 ноября 2025 г.",
      // "2025 m. sausio 12 d."), which the sentence's would double.
      t(s.openDate <= today ? 'server.about.opened' : 'server.about.opens', { date: fullDate(s.openDate) }).replace(/\.\.$/, '.'),
      ...(!options.brief && s.rate != null ? [t(`server.about.${rateKind(s.rate)}`)] : []),
      ...(options.rank ? [t('server.about.votes', { votes: s.votes, rank: options.rank })] : [])
    ].join(NO_SPACES.has(locale.value) ? '' : ' ')
  }

  return { fullDate, aboutText }
}
