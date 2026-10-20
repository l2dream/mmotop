import { gameById, chronicleBadge } from '~/data/games'
import type { Server } from '~/data/servers'

// Dates are stored as ISO ("2024-12-23") and only formatted for display, so the
// stored value stays unambiguous and a future language switch only changes MONTHS.
// Rendering the month as a word avoids the 05.06 trap, where a numeric date reads
// as two different days depending on the reader's convention.
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// Parsed by hand rather than through Date: `new Date('2024-12-23')` is UTC midnight,
// so getDate() would report the 22nd for anyone west of Greenwich.
function parseISODate(iso?: string) {
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day || month < 1 || month > 12) return null
  return { year, month, day }
}

/**
 * How a server's fields read on screen, shared by the home panels and the
 * section pages so a row looks the same wherever it appears.
 */
export function useServerFormat() {
  const { t } = useI18n()

  /**
   * Starts at the build year rather than null, so the prerendered HTML already
   * carries the right year labels and nothing has to be deleted after
   * hydration. The dashboard sets the real year on mount, which matters for
   * exactly one window a year: between 1 January and the next deploy.
   */
  const currentYear = useState('dash-year', () => useRuntimeConfig().public.buildYear as number)

  const months = computed(() => MONTH_KEYS.map((key) => t(`months.${key}`)))

  function serverBadge(server: Server) {
    return chronicleBadge(server.game, server.chronicle)
  }

  /**
   * "Lineage II" — the line under the server name. It used to read
   * "MMORPG / Lineage II", but every game listed is an MMORPG, and the genre
   * took half the line: on a phone the game itself was cut to "W…".
   */
  function serverSubtitle(server: Server) {
    return gameById(server.game)?.name ?? ''
  }

  function rateLabel(server: Server) {
    return server.rate == null ? '' : `x${server.rate}`
  }

  // Split across two lines in the card, so the column stays narrow: day and month
  // carry the meaning, the year sits under them as the quieter half.
  //
  // The order comes from the locale rather than being hard-coded, because it is
  // the one thing that genuinely differs between English and American English:
  // everyone else writes 5 Oct, the United States writes Oct 5. Getting that
  // wrong is exactly the confusion the worded month was adopted to avoid.
  function formatDayMonth(iso?: string) {
    const parsed = parseISODate(iso)
    if (!parsed) return iso ?? ''
    // Handed to vue-i18n as parameters rather than patched in with .replace():
    // {day} and {month} are its own interpolation syntax, and a plain t() call
    // resolves them against nothing and returns a bare space.
    return t('dateFormat', {
      day: parsed.day,
      month: months.value[parsed.month - 1] ?? ''
    })
  }

  // The year is dropped only when it's the current one, where it reads as noise.
  // Anything older or further ahead keeps it, so an established server is never
  // mistaken for a fresh one and a January date isn't ambiguous.
  function formatYear(iso?: string) {
    const parsed = parseISODate(iso)
    if (!parsed) return ''
    if (parsed.year === currentYear.value) return ''
    return String(parsed.year)
  }

  return { currentYear, serverBadge, serverSubtitle, rateLabel, formatDayMonth, formatYear }
}
