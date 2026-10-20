<script setup lang="ts">
import { bcp47, localeByCode } from '~/i18n/locales'
import { GAMES, gameById, chronicleShort } from '~/data/games'
import { SERVERS, type Server } from '~/data/servers'
import type { SectionId } from '~/data/sections'

/**
 * The whole site: the home page with its five panels; given `section`, one of
 * those lists on its own page, in full; given `serverId`, one server's page.
 * All share the header, search, filters and category bar, so a filter set on
 * the home page still applies after View more, and the other way round.
 */
const props = defineProps<{ section?: SectionId, serverId?: string }>()

const { t, locale } = useI18n()
const { currentYear, serverSubtitle, rateLabel } = useServerFormat()

// Every row on the page comes from app/data/servers.ts; the games, their
// chronicles and the category bar come from app/data/games.ts.

const categories = ['all', ...GAMES.map((g) => g.id)]

function categoryLabel(category: string) {
  return category === 'all' ? t('categories.all') : gameById(category)?.name ?? category
}

const VISIBLE_CATEGORIES = 6
const visibleCategories = computed(() => categories.slice(0, VISIBLE_CATEGORIES))
const hiddenCategories = computed(() => categories.slice(VISIBLE_CATEGORIES))

/**
 * A category picked from the More menu used to leave no trace in the bar: the
 * menu closed and nothing visible said which game was selected. The More
 * button takes the category's name instead, and stays highlighted.
 */
const activeHidden = computed(() => hiddenCategories.value.includes(activeCategory.value))

const SERVER_BY_ID = new Map(SERVERS.map((server) => [server.id, server]))
const server = computed(() => (props.serverId ? SERVER_BY_ID.get(props.serverId) : undefined))

/**
 * Today's date, for splitting COMING SOON from ALREADY STARTED. It starts as
 * the build date so the prerendered HTML and the first client render agree,
 * then becomes the visitor's own date on mount — otherwise a server would
 * stay "coming soon" until the next deploy, however long ago it opened.
 */
const today = ref(useRuntimeConfig().public.buildDate as string)
function localISODate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// A random pick, so the panel can surface servers that hold no place in the
// vote ranking and have no launch date to show. Drawn in the browser rather
// than at build time: a static build would freeze one "random" set into the
// HTML and every visitor would see it until the next deploy.
//
// The whole pool is shuffled and kept, and the panel takes the first three
// that pass the filters. It used to pick three and filter afterwards, so with
// Version = High-Five (three servers of ten) roughly three loads in ten showed
// "No games match" while three matching servers sat unpicked in the pool.
//
// Kept in useState so the pick survives a language switch rather than being
// redrawn — a visitor comparing two languages should see the same servers.
const RANDOM_PICK = 3
// Ids rather than the servers themselves: useState is serialised into the
// page payload, and there is no reason to ship every server twice.
const shuffledPool = useState<string[]>('dash-shuffled-pool', () => SERVERS.map((s) => s.id))
const hasShuffled = useState('dash-has-shuffled', () => false)
// Counts deliberate shuffles only, so the button's half-turn answers a click
// and not every page load and every language change.
const shuffleTurns = useState('dash-shuffle-turns', () => 0)

function shufflePool() {
  const pool = SERVERS.map((s) => s.id)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  shuffledPool.value = pool
  hasShuffled.value = true
}

function shuffleGames() {
  shufflePool()
  shuffleTurns.value++
}

// Held outside the component: switching language rebuilds this page, and
// everything the visitor deliberately set would be thrown away with it.
// See useDashboardState for the full reasoning.
const {
  dark, query, activeCategory,
  filters, customRateActive, customRateMin, customRateMax
} = useDashboardState()

const showMore = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const moreWrap = ref<HTMLElement | null>(null)
const categoryBar = ref<HTMLElement | null>(null)

/**
 * Which ends of the category bar have more games past them. On a phone the
 * bar shows two or three games and simply stopped mid-word, with nothing to
 * say it scrolls. Each end now fades while there is more beyond it, and only
 * then: a bar that fits, as on a wide screen, has no fade at all.
 *
 * Math.abs because in a right-to-left page scrollLeft counts down from zero.
 */
const barFade = ref({ start: false, end: false })
function updateBarFade() {
  const bar = categoryBar.value
  if (!bar) return
  const pos = Math.abs(bar.scrollLeft)
  const max = bar.scrollWidth - bar.clientWidth
  barFade.value = { start: pos > 1, end: pos < max - 1 }
}
// Picking a game from More writes its name on the button, which changes the
// bar's width.
watch(activeCategory, () => nextTick(updateBarFade))
const moreButton = ref<HTMLButtonElement | null>(null)
const moreDropdownEl = ref<HTMLElement | null>(null)
const dropdownPos = ref<PopupPlacement>({ top: 0, left: 0, maxHeight: 360 })

/**
 * The Version list, grouped by game — "Classic" alone would not say which
 * game's. With a category chosen it narrows to that game's chronicles, and the
 * value carries the game too, so two games can share a chronicle name.
 */
const versionGroups = computed(() =>
  GAMES.filter((g) => activeCategory.value === 'all' || g.id === activeCategory.value)
    .map((g) => ({ id: g.id, name: g.name, chronicles: g.chronicles.map((c) => c.name) }))
)
function versionKey(gameId: string, chronicle: string) {
  return `${gameId}:${chronicle}`
}

// Game and Version stay in step both ways. A version belongs to one game, so
// choosing it first sets the game to match; the game used to stay on "All
// games" beside it. Changing the game away from that version — to another
// game or to all of them — drops the version, which would otherwise silently
// empty every panel or contradict the game shown.
watch(() => filters.value.version, (v) => {
  if (v) activeCategory.value = v.slice(0, v.indexOf(':'))
})
watch(activeCategory, (category) => {
  const v = filters.value.version
  if (v && !v.startsWith(`${category}:`)) filters.value.version = ''
})

/**
 * Each tier holds the rates above its min up to and including its max, so a
 * shared boundary belongs to the lower one: x5 is in x0–x5, not x5–x10. The
 * old tiers ran 1–5, 6–10 and so on, which left a decimal rate such as x5.5
 * in none of them.
 */
const rateTiers = [
  { label: 'x0–x5', min: 0, max: 5 },
  { label: 'x5–x10', min: 5, max: 10 },
  { label: 'x10–x100', min: 10, max: 100 },
  { label: 'x100–x1000', min: 100, max: 1000 },
  { label: 'x1000+', min: 1000, max: Infinity }
]
/** Kept in filters.rates beside the tier labels; matches servers with no rate. */
const NO_RATE = 'none'


// The browser's own date and year replace the build's on mount: a server
// would otherwise stay "coming soon" until the next deploy, and a year label
// linger past New Year.
onMounted(() => {
  currentYear.value = new Date().getFullYear()
  today.value = localISODate()
  // Drawn after hydration, so each visit gets its own pick — and only once per
  // visit, so switching language keeps it.
  if (!hasShuffled.value) shufflePool()
})


const customMin = computed(() => {
  const n = parseFloat(customRateMin.value)
  return Number.isFinite(n) ? n : null
})
const customMax = computed(() => {
  const n = parseFloat(customRateMax.value)
  return Number.isFinite(n) ? n : null
})
const customRateSet = computed(() => customMin.value != null || customMax.value != null)

/**
 * The range in the order it means, whichever box each number went into.
 * Typed as 500 – 100 it used to be read literally, match nothing, and empty
 * every panel with no hint as to why.
 */
const customRange = computed(() => {
  const lo = customMin.value
  const hi = customMax.value
  if (lo != null && hi != null && lo > hi) return { lo: hi, hi: lo }
  return { lo, hi }
})
const rateFilterActive = computed(() => filters.value.rates.length > 0 || (customRateActive.value && customRateSet.value))

const filterOpen = ref(false)
const filterButtonEl = ref<HTMLElement | null>(null)
const filterPopupEl = ref<HTMLElement | null>(null)
const filterPos = ref<PopupPlacement>({ top: 0, left: 0, maxHeight: 600 })

// The game counts too: the popup has a Game field, and a narrowed game with
// no badge looked like no filter at all. A version already implies its game,
// so the two together count once.
const activeFilterCount = computed(
  () =>
    (filters.value.version || activeCategory.value !== 'all' ? 1 : 0) +
    (rateFilterActive.value ? 1 : 0)
)

function matchesFilters(server: Server) {
  if (filters.value.version && versionKey(server.game, server.chronicle) !== filters.value.version) return false
  if (rateFilterActive.value) {
    const rate = server.rate
    if (rate == null) return filters.value.rates.includes(NO_RATE)
    const inPreset = filters.value.rates.some((label) => {
      const tier = rateTiers.find((t) => t.label === label)
      return tier && rate > tier.min && rate <= tier.max
    })
    const inCustom =
      customRateActive.value &&
      customRateSet.value &&
      (customRange.value.lo == null || rate >= customRange.value.lo) &&
      (customRange.value.hi == null || rate <= customRange.value.hi)
    if (!inPreset && !inCustom) return false
  }
  return true
}

function toggleRateFilter(label: string) {
  const idx = filters.value.rates.indexOf(label)
  if (idx === -1) filters.value.rates.push(label)
  else filters.value.rates.splice(idx, 1)
}

/**
 * The From/To fields appear under the chips, and on a phone held sideways
 * that is below the bottom of the popup — or just under the pinned
 * Reset/Apply bar: tapping Custom seemed to do nothing until you scrolled.
 * The popup now scrolls just far enough to show them above that bar.
 *
 * By hand rather than scrollIntoView: the fields are technically inside the
 * popup's box while hidden under the sticky bar, so "nearest" did nothing.
 * Only the popup moves, never the page, and nothing is focused, which on a
 * phone would put the keyboard over everything.
 */
const customRateEl = ref<HTMLElement | null>(null)
async function toggleCustomRate() {
  customRateActive.value = !customRateActive.value
  if (!customRateActive.value) return
  await nextTick()
  const popup = filterPopupEl.value
  const fields = customRateEl.value
  const bar = popup?.querySelector('.filter-popup-actions')
  if (!popup || !fields || !bar) return
  const overlap = fields.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 8
  if (overlap > 0) popup.scrollBy({ top: overlap, behavior: 'smooth' })
}

// Clears the game as well — it is a field in this popup like the others. The
// category bar shares the same state, so it goes back to "All" with it.
function resetFilters() {
  activeCategory.value = 'all'
  filters.value.version = ''
  filters.value.rates = []
  customRateActive.value = false
  customRateMin.value = ''
  customRateMax.value = ''
}

/**
 * The filters live in the address as well, so a reload — or a link someone
 * was sent — comes back with them set:
 *
 *   ?game=wow&version=WotLK 3.3.5a&rate=0-5,none&min=2&max=50&q=frost
 *
 * The search text rides along as q, so a reload keeps what was typed too.
 *
 * The address rather than localStorage, so the site still opens unfiltered
 * when someone simply comes back to it, and a filtered view can be shared.
 * Rate tiers go in as "0-5" rather than their "x0–x5" labels, which would
 * travel as %E2%80%93. Anything unknown in the address is ignored.
 *
 * Read once on mount, then written back with router.replace on every change,
 * so the back button is not filled with one entry per click. The prerendered
 * page has no filters, so a filtered reload shows everything for the moment
 * before the script runs; a static host cannot do better without rendering
 * each combination ahead of time.
 */
const route = useRoute()
const router = useRouter()

const rateSlug = (label: string) => label === NO_RATE ? 'none' : label.replace(/x/g, '').replace('–', '-')
const RATE_BY_SLUG = new Map([...rateTiers.map((r) => r.label), NO_RATE].map((label) => [rateSlug(label), label]))

function firstParam(v: unknown): string {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : ''
}

function restoreFiltersFromUrl() {
  const q = route.query
  const game = firstParam(q.game)
  const chronicle = firstParam(q.version)
  const rates = firstParam(q.rate).split(',').map((r) => RATE_BY_SLUG.get(r)).filter((r): r is string => !!r)
  const min = firstParam(q.min), max = firstParam(q.max)
  const text = firstParam(q.q)
  // An address with no filter in it — the bare page, or a language switch,
  // whose links carry no query — leaves the state as it is.
  if (!game && !chronicle && !rates.length && !min && !max && !text) return

  const g = gameById(game)
  activeCategory.value = g ? g.id : 'all'
  filters.value.version = g?.chronicles.some((c) => c.name === chronicle) ? versionKey(g.id, chronicle) : ''
  filters.value.rates = rates
  customRateActive.value = !!(min || max)
  customRateMin.value = min
  customRateMax.value = max
  query.value = text
}

function filtersToQuery() {
  const params: Record<string, string> = {}
  if (activeCategory.value !== 'all') params.game = activeCategory.value
  const v = filters.value.version
  if (v) params.version = v.slice(v.indexOf(':') + 1)
  if (filters.value.rates.length) params.rate = filters.value.rates.map(rateSlug).join(',')
  if (customRateActive.value) {
    if (customRateMin.value) params.min = customRateMin.value
    if (customRateMax.value) params.max = customRateMax.value
  }
  if (query.value.trim()) params.q = query.value
  return params
}

// Other parameters in the address (utm tags and the like) are kept as found.
//
// A server's page has no list for the filters to narrow, so there a change to
// them — a category picked, filters applied, a search sent — goes to the home
// page with the filters set, which is where they have something to show.
function writeFiltersToUrl() {
  if (server.value) {
    router.push({ path: localePath('/'), query: filtersToQuery() })
    return
  }
  const { game: _g, version: _v, rate: _r, min: _n, max: _x, q: _q, ...rest } = route.query
  router.replace({ query: { ...rest, ...filtersToQuery() }, hash: route.hash })
}

// onNuxtReady, not onMounted. A prerendered page hydrates under the path it
// was rendered at, query-less, and Nuxt only puts the real address back once
// the app has fully loaded. Read at mount, the query wasn't there yet; written
// at mount, Nuxt's restore then overwrote it, so a second reload lost them.
//
// The watcher is created here in setup, gated on urlReady, rather than inside
// the onNuxtReady callback: that callback runs outside the component, so a
// watcher made there was never stopped, and every language switch — which
// remounts this page — left one more behind, all writing the same address.
const urlReady = ref(false)
let unmounted = false
onUnmounted(() => { unmounted = true })
watch([activeCategory, filters, customRateActive, customRateMin, customRateMax], () => {
  if (!urlReady.value) return
  clearTimeout(searchUrlTimer)
  writeFiltersToUrl()
}, { deep: true })

/**
 * The search text is written to the address half a second after typing
 * stops, not on every key, so the address bar and history are not churned
 * once per letter. Leaving the field writes at once. A reload inside that
 * half second comes back without the last letters typed; writing on the way
 * out cannot help — a reload keeps the address it started with, before any
 * pagehide or beforeunload handler runs.
 *
 * On a touch screen this used to wait for the field to be left, on the
 * theory that address changes shoved the page on Android. They did not (that
 * was the visual viewport, see interactive-widget in nuxt.config.ts), and the
 * wait meant a reload with the keyboard up lost the search entirely.
 */
let searchUrlTimer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  // On a server's page the search is sent with Enter or the search button;
  // leaving for the home page mid-word would take the field away while typing.
  if (!urlReady.value || server.value) return
  clearTimeout(searchUrlTimer)
  searchUrlTimer = setTimeout(writeFiltersToUrl, 500)
})
function onSearchBlur() {
  releaseDashboardHeight()
  if (!urlReady.value || server.value) return
  clearTimeout(searchUrlTimer)
  writeFiltersToUrl()
}

/**
 * While the field has focus the page is not allowed to get shorter. Each key
 * can remove rows, and a page that shrinks under a scrolled view makes the
 * browser pull the scroll position back — on a phone, with the keyboard up,
 * that is the whole page jumping once per letter. The height is held at what
 * it was when typing began and let go when the field is left.
 */
const dashboardEl = ref<HTMLElement | null>(null)
function holdDashboardHeight() {
  const el = dashboardEl.value
  if (el) el.style.minHeight = `${el.offsetHeight}px`
}
function releaseDashboardHeight() {
  if (dashboardEl.value) dashboardEl.value.style.minHeight = ''
}

onUnmounted(() => clearTimeout(searchUrlTimer))
onNuxtReady(() => {
  if (unmounted) return
  // A server's address carries no filters, and writing them into it would
  // send the visitor straight back to the home page.
  if (server.value) {
    urlReady.value = true
    return
  }
  restoreFiltersFromUrl()
  writeFiltersToUrl()
  urlReady.value = true
})

/**
 * The wordmark goes to this language's home page — `to="/"` used to send a
 * German visitor to the English one — and back to its starting state: no
 * filters, no game, no search, scrolled to the top. Already on the home page
 * with filters set, the link alone changed nothing visible, since the filters
 * live in shared state and were written straight back into the address.
 * A plain link still, so a middle-click opens a fresh tab as expected.
 */
const localePath = useLocalePath()
function goHome() {
  resetFilters()
  query.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** A category is a game; "all" matches everything. */
function matchesCategory(server: Server) {
  return activeCategory.value === 'all' || server.game === activeCategory.value
}

/**
 * The search box used to apply to the TOP panel only, while the filter popup
 * applied to all five — so typing "High-Five" narrowed one panel and left four
 * untouched. It applies everywhere now, like the filters beside it.
 *
 * Filters on exactly what is in the field, on every keystroke. The field is
 * bound by hand rather than with v-model, which drops `input` events while an
 * input method is composing — and on most Android keyboards every Latin word
 * is composed, so nothing narrowed until a space or Enter.
 *
 * Unlike the language list, a composing query that matches nothing is NOT
 * ignored: on those same keyboards it is simply what the visitor typed, and
 * ignoring it put every server back on screen for "wow".
 */
function matchesSearch(server: Server) {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  const aliases = gameById(server.game)?.aliases?.join(' ') ?? ''
  // Aliases last: in the middle they split "World of Warcraft Classic".
  return `${server.name} ${serverSubtitle(server)} ${server.chronicle} ${chronicleShort(server.game, server.chronicle)} ${rateLabel(server)} ${aliases}`.toLowerCase().includes(q)
}

function matchesAll(server: Server) {
  return matchesCategory(server) && matchesSearch(server) && matchesFilters(server)
}

/**
 * Sorted by votes once; ranked after filtering. The places — and so the gold,
 * silver and bronze — are counted within whatever the filters leave: choose
 * Interlude and the best Interlude server is 1st, whatever its overall place.
 * The TOP answers "which is best among what I am looking at".
 */
const serversByVotes = [...SERVERS]
  .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))

// Opening dates decide the two date lists, measured against `today`: the
// nearest opening first in one, the most recent in the other.
const upcoming = computed(() =>
  SERVERS.filter((s) => s.openDate > today.value).sort((a, b) => a.openDate.localeCompare(b.openDate)))
const opened = computed(() =>
  SERVERS.filter((s) => s.openDate <= today.value).sort((a, b) => b.openDate.localeCompare(a.openDate)))
// Newest additions to MMOTOP, whether they have opened yet or not.
const recentlyListed = [...SERVERS].sort((a, b) => b.listedAt.localeCompare(a.listedAt))

interface Row { server: Server, rank?: number }
const rows = (list: Server[]): Row[] => list.map((server) => ({ server }))

/**
 * Every list in full, after the filters and the search. The home panels show
 * the head of each; the section pages show all of it. ALL GAMES follows the
 * shuffled pool in both places — a few at home, all of it on its page — so it
 * keeps surfacing servers with no rank or date to show them by, and its
 * Shuffle button draws both again.
 */
const fullLists = computed<Record<SectionId, Row[]>>(() => ({
  top: serversByVotes.filter(matchesAll).map((server, i) => ({ server, rank: i + 1 })),
  soon: rows(upcoming.value.filter(matchesAll)),
  started: rows(opened.value.filter(matchesAll)),
  new: rows(recentlyListed.filter(matchesAll)),
  all: rows(shuffledPool.value
    .map((id) => SERVER_BY_ID.get(id))
    .filter((s): s is Server => !!s && matchesAll(s)))
}))

const PANEL_ROWS = 10
const NEW_ROWS = 3
const homeLists = computed<Record<SectionId, Row[]>>(() => ({
  top: fullLists.value.top.slice(0, PANEL_ROWS),
  soon: fullLists.value.soon.slice(0, PANEL_ROWS),
  started: fullLists.value.started.slice(0, PANEL_ROWS),
  new: fullLists.value.new.slice(0, NEW_ROWS),
  all: fullLists.value.all.slice(0, RANDOM_PICK)
}))

/** How each list's rows end, and its panel's accent colour. */
const ROW_END = { top: 'votes', soon: 'date', started: 'date', new: 'date', all: 'chronicle' } as const
const ACCENT: Record<SectionId, string> = {
  top: 'accent-gold', soon: 'accent-blue', started: 'accent-amber', new: 'accent-violet', all: 'accent-teal'
}

/**
 * A section page shows its list a page at a time, so a list of hundreds does
 * not arrive as one enormous page; the button under it adds the next page.
 * Changing the filters or the search starts again from the top.
 */
const SECTION_PAGE = 25
const sectionShown = ref(SECTION_PAGE)
const sectionList = computed(() => (props.section ? fullLists.value[props.section] : []))
watch([query, activeCategory, filters, customRateActive, customRateMin, customRateMax], () => {
  sectionShown.value = SECTION_PAGE
}, { deep: true })

// The filters travel with the link, so the full list opens the way the panel
// was showing it.
const sectionLink = (id: SectionId) => ({ path: localePath(`/${id}`), query: route.query })

// TOP GAMES holds every server that passes the filters and the search, so it
// being empty means every list is.
const nothingFound = computed(() => fullLists.value.top.length === 0)
const searchText = computed(() => query.value.trim())

// Getters rather than values: the tags have to follow the language, not be
// frozen at whatever it was when the component first ran.
const pageTitle = computed(() => {
  if (server.value) return `${server.value.name} — ${serverSubtitle(server.value)} — MMOTOP`
  return props.section ? `${t(`seo.${props.section}.title`)} — MMOTOP` : t('meta.title')
})
// The page's subject for its one h1: on a section page the plain-words name
// ("Top game servers by votes"), not the capitalised panel label.
const pageHeading = computed(() => (props.section ? t(`seo.${props.section}.title`) : t('meta.title')))
const pageDescription = computed(() => (server.value
  ? t('server.description', {
    name: server.value.name,
    game: serverSubtitle(server.value),
    chronicle: server.value.chronicle
  })
  : props.section ? t(`seo.${props.section}.description`) : t('meta.description')))

/** A server's place among all servers by votes. */
const serverRank = computed(() => (server.value ? serversByVotes.indexOf(server.value) + 1 : 0))

/**
 * The list a server was last opened from — a home panel, a section page —
 * set by the row that was clicked (see ServerRow). Held for the visit, so
 * moving from server to server keeps it; a server page opened directly has
 * none.
 */
const serverOrigin = useState<SectionId | null>('dash-origin', () => null)

/** Each list in its own order, before any filter or search. */
const listOrder = computed<Record<SectionId, Server[]>>(() => ({
  top: serversByVotes,
  soon: upcoming.value,
  started: opened.value,
  new: recentlyListed,
  all: shuffledPool.value.map((id) => SERVER_BY_ID.get(id)).filter((s): s is Server => !!s)
}))

/**
 * The panel under a server's card: more servers of the same game from the
 * list the visitor came through — came from COMING SOON, more Lineage II
 * servers opening soon — in that list's order, with its way to the full list.
 * Opened directly, there is no list to follow, and it shows the game's best
 * by votes, as before.
 */
const SERVER_OTHERS = 5

/**
 * The panel recommends: of the candidates, the ones most like this server
 * (same chronicle, close rates, opening around the same time, a similar
 * following — see serverSimilarity) are the likeliest to be picked, but the
 * pick is still a draw, so each visit and each Shuffle shows a different
 * five and nothing is shown every single time.
 *
 * A weighted draw without replacement: each server gets a random number
 * raised to 1/weight, and the five largest win. A random number per server
 * rather than a shuffled array, so the pick survives the list itself
 * changing under it — today's date moving from the build's to the visitor's,
 * the ALL GAMES pool being drawn. Until mount there are no numbers and the
 * five most similar are shown, so the prerendered page and the first render
 * agree.
 */
const othersKeys = ref<Map<string, number> | null>(null)
const othersTurns = ref(0)
function drawOthers() {
  othersKeys.value = new Map(SERVERS.map((s) => [s.id, Math.random()]))
}
function shuffleOthers() {
  drawOthers()
  othersTurns.value++
}
onMounted(() => {
  if (server.value) drawOthers()
})

const serverOthers = computed(() => {
  if (!server.value) return null
  const current = server.value
  const game = serverSubtitle(current)
  const others = (list: Server[]) => list.filter((s) => s.game === current.game && s.id !== current.id)
  // A list with no other server of this game — the only Silkroad server
  // opening soon — would leave the page with nothing under the card; the
  // game's best by votes stand in.
  const fromOrigin = serverOrigin.value ? others(listOrder.value[serverOrigin.value]) : []
  const origin = fromOrigin.length ? serverOrigin.value : null
  const sameGame = (origin ? listOrder.value[origin] : serversByVotes).filter((s) => s.game === current.game)
  const keys = othersKeys.value
  const scored = sameGame
    .filter((s) => s.id !== current.id)
    .map((s) => {
      const score = serverSimilarity(current, s)
      // exp: each point of likeness makes a server about three times as
      // likely to be drawn.
      const draw = keys ? keys.get(s.id)! ** (1 / Math.exp(1.1 * score)) : score
      return { s, score, draw }
    })
  const rows = scored
    .sort((a, b) => b.draw - a.draw)
    .slice(0, SERVER_OTHERS)
    // Shown most alike first, whatever order they were drawn in.
    .sort((a, b) => b.score - a.score)
    .map(({ s }) => s)
    // A place in TOP counts within the game, as the TOP page shows it with
    // this game chosen.
    .map((s) => ({ server: s, rank: origin === 'top' ? sameGame.indexOf(s) + 1 : undefined }))
  return {
    rows,
    origin,
    title: origin ? `${t(`panels.${origin}`)} · ${game}` : t('server.others', { game }),
    turns: othersTurns.value,
    end: origin ? ROW_END[origin] : 'chronicle' as const,
    link: origin ? { path: localePath(`/${origin}`), query: { game: current.game } } : undefined
  }
})

useSeoMeta({
  title: () => pageTitle.value,
  description: () => pageDescription.value,
  ogTitle: () => pageTitle.value,
  ogDescription: () => (server.value || props.section ? pageDescription.value : t('meta.ogDescription')),
  ogType: 'website',
  ogSiteName: 'MMOTOP',
  /**
   * Read from the registry rather than derived from the URL code. Open Graph
   * requires language_TERRITORY, and deriving gave a bare "ko" or "ru" for
   * twenty-four of the twenty-six — which consumers simply drop, so every
   * shared link carried no locale signal at all.
   */
  ogLocale: () => localeByCode(locale.value)?.ogLocale
  // The image and the card type are set once for every page, in app.vue.
})

/**
 * Structured data: what each page is, in the form search engines read.
 *
 * The home page names the site. A section or server page carries its
 * breadcrumb — MMOTOP › Top game servers, MMOTOP › LA2DREAM — which Google
 * can show in place of the bare address; a section page also lists the
 * servers on it. Addresses are absolute and end in a slash, as the pages are
 * served.
 */
// localePath gives the route's path; the site's base (/mmotop/ on Pages) is
// the router's to add, so it is added here by hand.
const siteRoot = (useRuntimeConfig().public.siteUrl as string).replace(/\/$/, '')
  + useRuntimeConfig().app.baseURL.replace(/\/$/, '')
const absolute = (path: string) => `${siteRoot}${localePath(path).replace(/\/?$/, '/')}`

const structuredData = computed(() => {
  const home = absolute('/')
  const crumbs = (name: string, url: string) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'MMOTOP', item: home },
      { '@type': 'ListItem', position: 2, name, item: url }
    ]
  })
  if (server.value) {
    return [crumbs(server.value.name, absolute(`/server/${server.value.id}`))]
  }
  if (props.section) {
    return [
      crumbs(t(`seo.${props.section}.title`), absolute(`/${props.section}`)),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: t(`seo.${props.section}.title`),
        itemListElement: sectionList.value.slice(0, SECTION_PAGE).map((row, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: row.server.name,
          url: absolute(`/server/${row.server.id}`)
        }))
      }
    ]
  }
  return [{
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MMOTOP',
    url: home,
    inLanguage: bcp47(locale.value)
  }]
})

useHead(() => ({
  script: structuredData.value.map((data, i) => ({
    key: `ld-json-${i}`,
    type: 'application/ld+json',
    innerHTML: JSON.stringify(data)
  }))
}))

function selectCategory(category: string, fromMore = false) {
  activeCategory.value = category
  if (!fromMore) return
  // The chosen item is removed with the menu, so focus goes back to the
  // button that opened it rather than falling to <body>.
  showMore.value = false
  moreButton.value?.focus()
}

/**
 * Catches a tap on the filter button made before the page has hydrated.
 *
 * The button is in the prerendered HTML from the first paint, but it does
 * nothing until the JavaScript has loaded — on a slow phone that was a couple
 * of seconds in which the tap was simply lost. This bit of inline script runs
 * with the HTML, notes the tap, and onMounted below opens the popup from it.
 */
const FILTER_EARLY_TAP = 'mmotopEarlyFilter'
useHead({
  script: [{
    key: 'filter-early-tap',
    innerHTML: `(function(){var h=function(e){var t=e.target;if(t&&t.closest&&t.closest('.filter-button'))window.${FILTER_EARLY_TAP}=!window.${FILTER_EARLY_TAP}};window.${FILTER_EARLY_TAP}Off=function(){document.removeEventListener('click',h,true)};document.addEventListener('click',h,true)})()`
  }]
})

function takeEarlyFilterTap() {
  const w = window as unknown as Record<string, unknown>
  ;(w[`${FILTER_EARLY_TAP}Off`] as (() => void) | undefined)?.()
  const tapped = w[FILTER_EARLY_TAP] === true
  delete w[FILTER_EARLY_TAP]
  delete w[`${FILTER_EARLY_TAP}Off`]
  if (tapped) filterOpen.value = true
}

function closeFilter() {
  filterOpen.value = false
  filterButtonEl.value?.focus()
}

function onDocumentPointer(event: PointerEvent) {
  const target = event.target as Node

  if (showMore.value && !moreWrap.value?.contains(target) && !moreDropdownEl.value?.contains(target)) {
    showMore.value = false
  }

  if (filterOpen.value) {
    const inButton = filterButtonEl.value?.contains(target)
    const inPopup = filterPopupEl.value?.contains(target)
    if (!inButton && !inPopup) filterOpen.value = false
  }
}

/**
 * Escape closes whichever popup is open and returns focus to the button that
 * opened it. It used to close both and leave focus on the element that had
 * just been removed, which drops a keyboard user at the top of the document.
 */
function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (filterOpen.value) closeFilter()
  if (showMore.value) {
    showMore.value = false
    moreButton.value?.focus()
  }
}

// Both popups go through placePopup — see app/utils/popup.ts for why one
// shared function rather than one per popup.
function positionDropdown() {
  const rect = moreWrap.value?.getBoundingClientRect()
  if (!rect) return
  dropdownPos.value = placePopup(rect, moreDropdownEl.value?.offsetWidth ?? 200, 'end')
}

function positionFilterPopup() {
  const rect = filterButtonEl.value?.getBoundingClientRect()
  if (!rect) return
  filterPos.value = placePopup(rect, filterPopupEl.value?.offsetWidth ?? 270, 'end', 10)
}

function repositionOpenPanels() {
  if (showMore.value) positionDropdown()
  if (filterOpen.value) positionFilterPopup()
}

watch(showMore, async (open) => {
  if (!open) return
  await nextTick()
  positionDropdown()
})

watch(filterOpen, async (open) => {
  if (!open) return
  await nextTick()
  positionFilterPopup()
})

onMounted(() => {
  // pointerdown, not click: iOS Safari does not reliably fire click for taps
  // on non-interactive areas, so tapping outside might never close a popup.
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', repositionOpenPanels)
  // Scroll too, and in the capture phase so the category bar's own horizontal
  // scroll counts. Both popups are position: fixed, and they used to stay put
  // while the page — and the button they belong to — scrolled away under them.
  window.addEventListener('scroll', repositionOpenPanels, true)
  window.addEventListener('resize', updateBarFade)
  updateBarFade()
  // Measured again once Inter arrives: the fallback face sets the names at a
  // different width.
  document.fonts?.ready.then(updateBarFade)
  takeEarlyFilterTap()
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', repositionOpenPanels)
  window.removeEventListener('scroll', repositionOpenPanels, true)
  window.removeEventListener('resize', updateBarFade)
})

const THEME_KEY = 'mmotop-theme'

/**
 * Applies the theme where the stylesheet looks for it — a class on <html> —
 * and remembers it. The theme used to live only in page state, so every reload
 * went back to dark whatever the visitor had chosen.
 */
function applyTheme(isDark: boolean, remember: boolean) {
  dark.value = isDark
  document.documentElement.classList.toggle('theme-light', !isDark)
  if (!remember) return
  try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light') } catch { /* private mode */ }
}

function toggleTheme() {
  applyTheme(!dark.value, true)
}

onMounted(() => {
  // The head script already painted the right theme; this brings the page's
  // own state (and so the sun/moon icon) into line with it.
  applyTheme(!document.documentElement.classList.contains('theme-light'), false)
})

function submitSearch() {
  if (server.value && query.value.trim()) return writeFiltersToUrl()
  searchInput.value?.focus()
}

/**
 * Enter in the field — the Search key on a phone's keyboard. The panels have
 * already narrowed as each letter went in, so on a touch screen it puts the
 * keyboard away, which otherwise kept half the results hidden under it. With a
 * mouse and keyboard there is nothing to dismiss, so the cursor stays.
 */
function onSearchEnter(event: KeyboardEvent) {
  if (server.value && query.value.trim()) return writeFiltersToUrl()
  if (window.matchMedia('(pointer: coarse)').matches) (event.target as HTMLInputElement).blur()
}

/** Back to everything, with the cursor left in the field to type again. */
function clearSearch() {
  query.value = ''
  searchInput.value?.focus()
  // Written now: the field keeps focus, so the touch-screen wait above would
  // otherwise leave the old text in the address until the field is left.
  onSearchBlur()
}

</script>

<template>
  <!-- The theme class lives on <html> now (see app.vue), so it is in place
       before the first paint rather than after hydration. -->
  <div class="site-shell">
    <svg width="0" height="0" style="position: absolute" aria-hidden="true">
      <defs>
        <linearGradient id="voteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFEA9E" />
          <stop offset="50%" stop-color="#FFD64A" />
          <stop offset="100%" stop-color="#F5A300" />
        </linearGradient>
        <!-- The same light-to-amber sweep, a few shades deeper, for white rows. -->
        <linearGradient id="voteGradLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E8B21C" />
          <stop offset="50%" stop-color="#C48A00" />
          <stop offset="100%" stop-color="#966200" />
        </linearGradient>
      </defs>
    </svg>

    <header class="topbar">
      <NuxtLink :to="localePath('/')" class="brand" :aria-label="$t('nav.home')" @click="goHome">MMOTOP</NuxtLink>
      <!-- The visible wordmark is a link home, not a heading, so the page had
           five h2s and no h1 at all. This states the subject once, for crawlers
           and for anyone listing the headings. -->
      <!-- A server's page shows its own h1, the server's name. -->
      <h1 v-if="!server" class="sr-only">{{ pageHeading }}</h1>

      <button class="theme-button" type="button" :aria-label="$t('nav.theme')" @click="toggleTheme">
        <svg
          v-if="dark"
          class="theme-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg
          v-else
          class="theme-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </button>

      <!-- A div, not a <label>: the label wrapped the filter and search buttons
           too, so their names were folded into the field's and a screen reader
           announced it as "Search games Filter Search". -->
      <div class="search-box" :class="{ 'has-query': query }">
        <input
          ref="searchInput"
          :value="query"
          type="search"
          :aria-label="$t('search.label')"
          :placeholder="$t('search.placeholder')"
          @input="query = ($event.target as HTMLInputElement).value"
          @keydown.enter="onSearchEnter"
          @focus="holdDashboardHeight"
          @blur="onSearchBlur"
        />
        <!-- The phone-width placeholder. The real one stays the full phrase and
             is hidden there by CSS; this one-word stand-in shows only while the
             field is empty. Pure CSS, so the prerendered page is already right
             and nothing swaps after hydration. -->
        <span class="search-hint" aria-hidden="true">{{ $t('search.short') }}</span>
        <button class="search-icon" type="button" :aria-label="$t('search.action')" @click="submitSearch">
          <svg class="search-svg" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <line x1="12.7" y1="12.7" x2="17" y2="17" />
          </svg>
        </button>
        <button
          v-if="query"
          class="search-clear"
          type="button"
          :aria-label="$t('search.clear')"
          @click="clearSearch"
        >
          <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <line x1="5" y1="5" x2="15" y2="15" />
            <line x1="15" y1="5" x2="5" y2="15" />
          </svg>
        </button>
        <button
          class="filter-button"
          type="button"
          :aria-label="activeFilterCount ? `${$t('filter.open')} (${activeFilterCount})` : $t('filter.open')"
          aria-haspopup="dialog"
          aria-controls="filter-popup"
          :aria-expanded="filterOpen"
          ref="filterButtonEl"
          :class="{ active: filterOpen || activeFilterCount > 0 }"
          @click="filterOpen = !filterOpen"
        >
          <svg class="filter-icon" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <circle cx="7" cy="5" r="1.6" fill="currentColor" stroke="none" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <circle cx="13" cy="10" r="1.6" fill="currentColor" stroke="none" />
            <line x1="3" y1="15" x2="17" y2="15" />
            <circle cx="9" cy="15" r="1.6" fill="currentColor" stroke="none" />
          </svg>
          <!-- The count is in the button's name above; the badge is for eyes. -->
          <span v-if="activeFilterCount > 0" class="filter-badge" aria-hidden="true">{{ activeFilterCount }}</span>
        </button>
      </div>

      <div
        v-if="filterOpen"
        id="filter-popup"
        class="filter-popup"
        ref="filterPopupEl"
        role="dialog"
        :aria-label="$t('filter.open')"
        :style="{ top: filterPos.top + 'px', left: filterPos.left + 'px', maxHeight: filterPos.maxHeight + 'px' }"
      >
        <div class="filter-popup-section">
          <label class="filter-popup-label" for="filter-game">{{ $t('filter.game') }}</label>
          <!-- The same choice as the category bar, not a second one that
               could contradict it: both edit activeCategory. -->
          <select id="filter-game" class="filter-select" v-model="activeCategory">
            <option value="all">{{ $t('filter.allGames') }}</option>
            <option v-for="game in GAMES" :key="game.id" :value="game.id">{{ game.name }}</option>
          </select>
        </div>

        <div class="filter-popup-section">
          <label class="filter-popup-label" for="filter-version">{{ $t('filter.version') }}</label>
          <select id="filter-version" class="filter-select" v-model="filters.version">
            <option value="">{{ $t('filter.allVersions') }}</option>
            <optgroup v-for="group in versionGroups" :key="group.id" :label="group.name">
              <option
                v-for="chronicle in group.chronicles"
                :key="chronicle"
                :value="versionKey(group.id, chronicle)"
              >{{ chronicle }}</option>
            </optgroup>
          </select>
        </div>

        <div class="filter-popup-section">
          <span id="filter-rate-label" class="filter-popup-label">{{ $t('filter.rate') }}</span>
          <div class="filter-chip-row" role="group" aria-labelledby="filter-rate-label">
            <button
              v-for="tier in rateTiers"
              :key="tier.label"
              type="button"
              class="filter-chip"
              :class="{ active: filters.rates.includes(tier.label) }"
              :aria-pressed="filters.rates.includes(tier.label)"
              @click="toggleRateFilter(tier.label)"
            >
              {{ tier.label }}
            </button>
            <button
              type="button"
              class="filter-chip"
              :class="{ active: filters.rates.includes(NO_RATE) }"
              :aria-pressed="filters.rates.includes(NO_RATE)"
              @click="toggleRateFilter(NO_RATE)"
            >
              {{ $t('filter.noRates') }}
            </button>
            <button
              type="button"
              class="filter-chip"
              :class="{ active: customRateActive }"
              :aria-pressed="customRateActive"
              @click="toggleCustomRate"
            >
              {{ $t('filter.custom') }}
            </button>
          </div>
          <div v-if="customRateActive" ref="customRateEl" class="filter-custom-rate">
            <input
              v-model="customRateMin"
              type="number"
              inputmode="decimal"
              min="0"
              :placeholder="$t('filter.from')"
              :aria-label="`${$t('filter.rate')}: ${$t('filter.from')}`"
              class="filter-custom-input"
            />
            <span class="filter-custom-sep" aria-hidden="true">–</span>
            <input
              v-model="customRateMax"
              type="number"
              inputmode="decimal"
              min="0"
              :placeholder="$t('filter.to')"
              :aria-label="`${$t('filter.rate')}: ${$t('filter.to')}`"
              class="filter-custom-input"
            />
          </div>
        </div>

        <div class="filter-popup-actions">
          <button type="button" class="filter-reset" @click="resetFilters">{{ $t('filter.reset') }}</button>
          <button type="button" class="filter-apply" @click="closeFilter">{{ $t('filter.apply') }}</button>
        </div>
      </div>

      <div class="account-actions">
        <LanguageSwitcher />

        <!-- aria-disabled until there is an account to sign in to: it is a real
             button, and without this a screen reader announced it as one and
             nothing happened when it was pressed. It keeps its look; only the
             cursor stops promising a click.

             Below 380px the label gives way to an icon, the way the language
             code does beside it — in Lithuanian and Latvian the word alone
             left the search field no room to type at 320px. -->
        <button class="login-button" type="button" aria-disabled="true" :aria-label="$t('nav.login')">
          <svg class="login-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
          </svg>
          <span class="login-label" aria-hidden="true">{{ $t('nav.login') }}</span>
        </button>
      </div>
    </header>

    <LanguageSuggestion />

    <nav class="category-bar" :aria-label="$t('nav.categories')">
      <div
        ref="categoryBar"
        class="category-scroll"
        :class="{ 'fade-start': barFade.start, 'fade-end': barFade.end }"
        @scroll.passive="updateBarFade"
      >
        <button
          v-for="category in visibleCategories"
          :key="category"
          class="category"
          :class="{ active: activeCategory === category }"
          :aria-pressed="activeCategory === category"
          type="button"
          @click="selectCategory(category)"
        >
          {{ categoryLabel(category) }}
        </button>

        <div class="category-more-wrap" ref="moreWrap">
          <button
            ref="moreButton"
            class="category more"
            :class="{ active: showMore || activeHidden }"
            type="button"
            aria-controls="more-categories"
            :aria-expanded="showMore"
            @click="showMore = !showMore"
          >
            {{ activeHidden ? categoryLabel(activeCategory) : $t('categories.more') }}
            <span class="more-chevron" :class="{ open: showMore }">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      <!-- A plain disclosure. role="menu" promised arrow-key navigation and
           focus-on-open, and neither existed — a screen reader user was told
           to use keys that did nothing. Beside the scrolling strip rather
           than inside it, where the strip's fade mask clipped it away; still
           straight after the More button in the DOM, so Tab reaches it. -->
      <div
        v-if="showMore"
        id="more-categories"
        ref="moreDropdownEl"
        class="more-dropdown"
        :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px', maxHeight: Math.min(360, dropdownPos.maxHeight) + 'px' }"
      >
        <button
          v-for="category in hiddenCategories"
          :key="category"
          class="more-dropdown-item"
          :class="{ active: activeCategory === category }"
          type="button"
          :aria-pressed="activeCategory === category"
          @click="selectCategory(category, true)"
        >
          {{ categoryLabel(category) }}
        </button>
      </div>
    </nav>

    <main ref="dashboardEl" class="dashboard">
      <!-- When nothing matches at all, one card says so and offers the way
           back, instead of five empty panels each repeating it. -->
      <div v-if="!server && nothingFound" class="no-results" role="status">
        <svg class="no-results-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <i18n-t v-if="searchText" keypath="search.nothing" tag="p" class="no-results-text" scope="global">
          <template #query><bdi class="no-results-query">{{ searchText }}</bdi></template>
        </i18n-t>
        <p v-else class="no-results-text">{{ $t('panels.empty') }}</p>
        <button v-if="searchText" type="button" class="no-results-action" @click="clearSearch">{{ $t('search.clear') }}</button>
        <button v-else type="button" class="no-results-action" @click="resetFilters">{{ $t('filter.reset') }}</button>
      </div>

      <div v-else-if="server" class="section-view">
        <BackLink :to="{ path: localePath('/'), query: filtersToQuery() }" />
        <ServerDetail :server="server" :rank="serverRank" :today="today" :others="serverOthers!" @shuffle="shuffleOthers" />
      </div>

      <template v-else-if="!section">
        <section v-for="(group, gi) in [['top', 'soon', 'started'], ['new', 'all']] as SectionId[][]" :key="gi" :class="gi === 0 ? 'top-grid' : 'bottom-grid'">
          <GamePanel v-for="id in group" :key="id" :title="$t(`panels.${id}`)" :class="ACCENT[id]" :to="sectionLink(id)">
            <template #icon><PanelIcon :id="id" /></template>
            <template v-if="id === 'all'" #actions>
              <ShuffleButton :turns="shuffleTurns" @shuffle="shuffleGames" />
            </template>
            <ServerRow
              v-for="row in homeLists[id]"
              :key="`${id}-${row.server.id}`"
              :server="row.server"
              :rank="row.rank"
              :end="ROW_END[id]"
              :origin="id"
            />
            <div v-if="homeLists[id].length === 0" class="empty-state">{{ $t('panels.none') }}</div>
            <PanelFooter v-else :to="sectionLink(id)" :title="$t(`panels.${id}`)" />
          </GamePanel>
        </section>
      </template>

      <!-- A section page: one list, in full, a page at a time. Narrower than
           the page, so a row does not stretch its name and its chronicle a
           thousand pixels apart. -->
      <div v-else class="section-view">
        <BackLink :to="{ path: localePath('/'), query: route.query }" />
        <GamePanel class="section-panel" :title="$t(`panels.${section}`)" :class="ACCENT[section]">
          <template #icon><PanelIcon :id="section" /></template>
          <template v-if="section === 'all'" #actions>
            <ShuffleButton :turns="shuffleTurns" @shuffle="shuffleGames" />
          </template>
          <ServerRow
            v-for="row in sectionList.slice(0, sectionShown)"
            :key="row.server.id"
            :server="row.server"
            :rank="row.rank"
            :end="ROW_END[section]"
            :origin="section"
          />
          <div v-if="sectionList.length === 0" class="empty-state">{{ $t('panels.none') }}</div>
          <button v-if="sectionList.length > sectionShown" type="button" class="panel-footer section-more" @click="sectionShown += SECTION_PAGE">
            {{ $t('panels.viewMore') }}
          </button>
        </GamePanel>
      </div>
    </main>

    <!-- Deliberately bare for now: just the copyright, until the rest of the
         site exists to link to. The year follows the same build-year-then-browser rule as the date
         labels, so the prerendered page is already right. -->
    <footer class="site-footer">
      <span class="site-footer-copy" dir="ltr">© {{ currentYear }} MMOTOP</span>
    </footer>
  </div>
</template>
