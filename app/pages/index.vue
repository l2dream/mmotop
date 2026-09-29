<script setup lang="ts">
import { localeByCode } from '~/i18n/locales'

const { t, locale } = useI18n()

type Game = {
  title: string
  genre: string
  version: string
  stars: number
  players: string
  /** Start date in ISO form, "YYYY-MM-DD". Formatted for display by formatDate(). */
  date?: string
}

const categories = [
  'All',
  'World of Warcraft',
  'Lineage II',
  'MuOnline',
  'AION',
  'Perfect World',
  'RF Online',
  'Silkroad Online',
  'Metin2',
  'Rappelz',
  'Tibia'
]

function categoryLabel(category: string) {
  return category === 'All' ? t('categories.all') : category
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

const games: Game[] = [
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'Interlude', stars: 500, players: 'x500' },
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'High-Five', stars: 500, players: 'x500' },
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'Interlude', stars: 500, players: 'x200' },
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'Interlude', stars: 500, players: 'x250' },
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'High-Five', stars: 500, players: 'x50' },
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'Interlude', stars: 500, players: 'x50' },
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'Interlude', stars: 500, players: 'x100' },
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'High-Five', stars: 500, players: 'x500' },
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'Interlude', stars: 500, players: 'x500' },
  { title: 'LA2DREAM', genre: 'MMORPG / Lineage II', version: 'Interlude', stars: 500, players: 'x500' }
]

// Upcoming servers: mostly this year, a couple spilling into the next one.
const soonDates = [
  '2026-10-05', '2026-10-18', '2026-11-02', '2026-11-20', '2026-12-01',
  '2026-12-15', '2026-12-28', '2027-01-10', '2027-01-24', '2027-02-07'
]

// Servers already running: recent ones through to a few long-lived projects.
const startedDates = [
  '2026-09-01', '2026-08-12', '2026-06-30', '2026-04-17', '2026-02-05',
  '2025-11-20', '2025-07-08', '2024-12-23', '2023-05-14', '2021-03-08'
]

const soon: Game[] = Array.from({ length: 10 }, (_, i) => ({
  ...games[i % games.length]!,
  date: soonDates[i]
}))

const started: Game[] = Array.from({ length: 10 }, (_, i) => ({
  ...games[(i + 1) % games.length]!,
  date: startedDates[i]
}))

// Newly listed games show their launch date rather than a vote count: a fresh
// entry has no votes yet, and an empty counter reads as unpopular rather than
// new. Two launches are still ahead, one has already happened.
const newGameDates = ['2026-10-12', '2026-11-05', '2026-08-20']
const newGames: Game[] = games.slice(0, 3).map((game, i) => ({ ...game, date: newGameDates[i] }))
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
const shuffledPool = useState<Game[]>('dash-shuffled-pool', () => [...games])
const hasShuffled = useState('dash-has-shuffled', () => false)
// Counts deliberate shuffles only, so the button's half-turn answers a click
// and not every page load and every language change.
const shuffleTurns = useState('dash-shuffle-turns', () => 0)

function shufflePool() {
  const pool = [...games]
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
const moreButton = ref<HTMLButtonElement | null>(null)
const moreDropdownEl = ref<HTMLElement | null>(null)
const dropdownPos = ref<PopupPlacement>({ top: 0, left: 0, maxHeight: 360 })

const allGameEntries = [...games, ...soon, ...started, ...newGames]
const allVersions = Array.from(new Set(allGameEntries.map((game) => game.version)))
const allTitles = Array.from(new Set(allGameEntries.map((game) => game.title)))

const ratingThresholds = computed(() => [
  { label: t('filter.any'), value: 0 },
  { label: '500+', value: 500 },
  { label: '1000+', value: 1000 },
  { label: '1500+', value: 1500 },
  { label: '2000+', value: 2000 }
])

const rateTiers = [
  { label: 'x1–x5', min: 1, max: 5 },
  { label: 'x6–x10', min: 6, max: 10 },
  { label: 'x11–x100', min: 11, max: 100 },
  { label: 'x101–x999', min: 101, max: 999 },
  { label: 'x1000+', min: 1000, max: Infinity }
]

// The rate is the "x"-prefixed number already shown under the star rating (game.players),
// e.g. "x500" -> 500. There's no separate rate field — this parses the existing one.
function getRate(game: Game) {
  return parseInt(game.players.replace(/[^0-9]/g, ''), 10) || 0
}

// Dates are stored as ISO ("2024-12-23") and only formatted for display, so the
// stored value stays unambiguous and a future language switch only changes MONTHS.
// Rendering the month as a word avoids the 05.06 trap, where a numeric date reads
// as two different days depending on the reader's convention.
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTHS = computed(() => MONTH_KEYS.map((key) => t(`months.${key}`)))

// Parsed by hand rather than through Date: `new Date('2024-12-23')` is UTC midnight,
// so getDate() would report the 22nd for anyone west of Greenwich.
function parseISODate(iso?: string) {
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day || month < 1 || month > 12) return null
  return { year, month, day }
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
    month: MONTHS.value[parsed.month - 1] ?? ''
  })
}

// Starts at the build year rather than null, so the prerendered HTML already
// carries the right year labels and nothing has to be deleted after hydration.
// The browser still reports the real year on mount, which matters for exactly
// one window a year: between 1 January and the next deploy.
const currentYear = ref<number | null>(useRuntimeConfig().public.buildYear as number)
onMounted(() => {
  currentYear.value = new Date().getFullYear()
  // Drawn after hydration, so each visit gets its own pick — and only once per
  // visit, so switching language keeps it.
  if (!hasShuffled.value) shufflePool()
})

// The year is dropped only when it's the current one, where it reads as noise.
// Anything older or further ahead keeps it, so an established server is never
// mistaken for a fresh one and a January date isn't ambiguous.
function formatYear(iso?: string) {
  const parsed = parseISODate(iso)
  if (!parsed) return ''
  if (currentYear.value !== null && parsed.year === currentYear.value) return ''
  return String(parsed.year)
}


const customMin = computed(() => {
  const n = parseInt(customRateMin.value, 10)
  return Number.isFinite(n) ? n : null
})
const customMax = computed(() => {
  const n = parseInt(customRateMax.value, 10)
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

const activeFilterCount = computed(
  () =>
    (filters.value.version ? 1 : 0) +
    (filters.value.minRating ? 1 : 0) +
    (filters.value.title ? 1 : 0) +
    (rateFilterActive.value ? 1 : 0)
)

function matchesFilters(game: Game) {
  if (filters.value.version && game.version !== filters.value.version) return false
  if (filters.value.minRating && game.stars < filters.value.minRating) return false
  if (filters.value.title && game.title !== filters.value.title) return false
  if (rateFilterActive.value) {
    const rate = getRate(game)
    const inPreset = filters.value.rates.some((label) => {
      const tier = rateTiers.find((t) => t.label === label)
      return tier && rate >= tier.min && rate <= tier.max
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

function toggleCustomRate() {
  customRateActive.value = !customRateActive.value
}

function resetFilters() {
  filters.value.version = ''
  filters.value.minRating = 0
  filters.value.title = ''
  filters.value.rates = []
  customRateActive.value = false
  customRateMin.value = ''
  customRateMax.value = ''
}

/**
 * The category bar used to move its highlight and filter nothing: every panel
 * kept listing the same servers whichever game was selected. A category now
 * matches a game whose genre or title names it; "All" matches everything.
 */
function matchesCategory(game: Game) {
  const category = activeCategory.value
  if (category === 'All') return true
  return game.genre.includes(category) || game.title === category
}

/**
 * The search box used to apply to the TOP panel only, while the filter popup
 * applied to all five — so typing "High-Five" narrowed one panel and left four
 * untouched. It applies everywhere now, like the filters beside it.
 */
function matchesSearch(game: Game) {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  return `${game.title} ${game.genre} ${game.version} ${game.players}`.toLowerCase().includes(q)
}

function matchesAll(game: Game) {
  return matchesCategory(game) && matchesSearch(game) && matchesFilters(game)
}

/**
 * Ranked once, by votes, before anything is filtered — so a server keeps its
 * own place. Filtering used to renumber the survivors from one, handing gold,
 * silver and bronze to whichever three happened to be left: filter to
 * High-Five and the servers ranked 2, 5 and 8 wore the medals for 1, 2 and 3.
 */
const rankedGames = [...games]
  .sort((a, b) => b.stars - a.stars)
  .map((game, i) => ({ game, rank: i + 1 }))

const filteredGames = computed(() => rankedGames.filter(({ game }) => matchesAll(game)))
const filteredSoon = computed(() => soon.filter(matchesAll))
const filteredStarted = computed(() => started.filter(matchesAll))
const filteredNewGames = computed(() => newGames.filter(matchesAll))
const filteredAllGames = computed(() => shuffledPool.value.filter(matchesAll).slice(0, RANDOM_PICK))

// Getters rather than values: the tags have to follow the language, not be
// frozen at whatever it was when the component first ran.
useSeoMeta({
  title: () => t('meta.title'),
  description: () => t('meta.description'),
  ogTitle: () => t('meta.title'),
  ogDescription: () => t('meta.ogDescription'),
  ogType: 'website',
  ogSiteName: 'MMOTOP',
  /**
   * Read from the registry rather than derived from the URL code. Open Graph
   * requires language_TERRITORY, and deriving gave a bare "ko" or "ru" for
   * twenty-four of the twenty-six — which consumers simply drop, so every
   * shared link carried no locale signal at all.
   */
  ogLocale: () => localeByCode(locale.value)?.ogLocale,
  /**
   * `summary`, not `summary_large_image`. The large card is a promise of a
   * 1200x630 image and there is no image anywhere in this project, so the
   * card rendered as a wide empty box. Worth upgrading once there is real
   * artwork to put in it; until then this declares what actually exists.
   */
  twitterCard: 'summary'
})

function selectCategory(category: string, fromMore = false) {
  activeCategory.value = category
  if (!fromMore) return
  // The chosen item is removed with the menu, so focus goes back to the
  // button that opened it rather than falling to <body>.
  showMore.value = false
  moreButton.value?.focus()
}

function closeFilter() {
  filterOpen.value = false
  filterButtonEl.value?.focus()
}

function onDocumentPointer(event: PointerEvent) {
  const target = event.target as Node

  if (showMore.value && moreWrap.value && !moreWrap.value.contains(target)) {
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
  filterPos.value = placePopup(rect, filterPopupEl.value?.offsetWidth ?? 270, 'start', 10)
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
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', repositionOpenPanels)
  window.removeEventListener('scroll', repositionOpenPanels, true)
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
  searchInput.value?.focus()
}

function gameIcon(game: Game) {
  return game.version === 'High-Five' ? 'HF' : 'II'
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
      </defs>
    </svg>

    <header class="topbar">
      <NuxtLink to="/" class="brand" :aria-label="$t('nav.home')">MMOTOP</NuxtLink>
      <!-- The visible wordmark is a link home, not a heading, so the page had
           five h2s and no h1 at all. This states the subject once, for crawlers
           and for anyone listing the headings. -->
      <h1 class="sr-only">{{ $t('meta.title') }}</h1>

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
      <div class="search-box">
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          :aria-label="$t('search.label')"
          :placeholder="$t('search.placeholder')"
          @keydown.enter="submitSearch"
        />
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
        <button class="search-icon" type="button" :aria-label="$t('search.action')" @click="submitSearch">
          <svg class="search-svg" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <line x1="12.7" y1="12.7" x2="17" y2="17" />
          </svg>
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
          <label class="filter-popup-label" for="filter-version">{{ $t('filter.version') }}</label>
          <select id="filter-version" class="filter-select" v-model="filters.version">
            <option value="">{{ $t('filter.allVersions') }}</option>
            <option v-for="version in allVersions" :key="version" :value="version">{{ version }}</option>
          </select>
        </div>

        <div class="filter-popup-section">
          <label class="filter-popup-label" for="filter-rating">{{ $t('filter.minRating') }}</label>
          <select id="filter-rating" class="filter-select" v-model.number="filters.minRating">
            <option v-for="threshold in ratingThresholds" :key="threshold.value" :value="threshold.value">
              {{ threshold.label }}
            </option>
          </select>
        </div>

        <div class="filter-popup-section">
          <label class="filter-popup-label" for="filter-game">{{ $t('filter.game') }}</label>
          <select id="filter-game" class="filter-select" v-model="filters.title">
            <option value="">{{ $t('filter.allGames') }}</option>
            <option v-for="title in allTitles" :key="title" :value="title">{{ title }}</option>
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
              :class="{ active: customRateActive }"
              :aria-pressed="customRateActive"
              @click="toggleCustomRate"
            >
              {{ $t('filter.custom') }}
            </button>
          </div>
          <div v-if="customRateActive" class="filter-custom-rate">
            <input
              v-model="customRateMin"
              type="number"
              min="0"
              :placeholder="$t('filter.from')"
              :aria-label="`${$t('filter.rate')}: ${$t('filter.from')}`"
              class="filter-custom-input"
            />
            <span class="filter-custom-sep" aria-hidden="true">–</span>
            <input
              v-model="customRateMax"
              type="number"
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

        <button class="login-button" type="button">
          <span>{{ $t('nav.login') }}</span>
        </button>
      </div>
    </header>

    <LanguageSuggestion />

    <nav class="category-bar" :aria-label="$t('nav.categories')">
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

        <!-- A plain disclosure. role="menu" promised arrow-key navigation and
             focus-on-open, and neither existed — a screen reader user was told
             to use keys that did nothing. -->
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
      </div>
    </nav>

    <main class="dashboard">
      <section class="top-grid">
        <GamePanel :title="$t('panels.top')" class="accent-gold">
          <template #icon>
            <svg class="trophy-icon" viewBox="0 0 24 24" width="24" height="24">
              <defs>
                <linearGradient id="trophyGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FFF1C2" />
                  <stop offset="35%" stop-color="#FFCB4D" />
                  <stop offset="75%" stop-color="#F5A623" />
                  <stop offset="100%" stop-color="#D6820A" />
                </linearGradient>
                <linearGradient id="trophyBase" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#C97A3D" />
                  <stop offset="100%" stop-color="#7A431E" />
                </linearGradient>
              </defs>
              <path d="M5 2h14v6a7 7 0 0 1-14 0V2z" fill="url(#trophyGold)" />
              <path
                d="M5 3C2 3 1 5 1 7.5S2 12 5 11.6"
                fill="none"
                stroke="url(#trophyGold)"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M19 3C22 3 23 5 23 7.5S22 12 19 11.6"
                fill="none"
                stroke="url(#trophyGold)"
                stroke-width="2"
                stroke-linecap="round"
              />
              <rect x="10.5" y="13" width="3" height="4" fill="url(#trophyBase)" />
              <path d="M8 17 L16 17 L18.5 20 L5.5 20 Z" fill="url(#trophyBase)" />
              <path
                d="M7.5 3.2C6.6 5 6.8 7 8 8.3"
                stroke="#FFFDF3"
                stroke-width="1.1"
                stroke-linecap="round"
                fill="none"
                opacity="0.55"
              />
            </svg>
          </template>
          <div v-for="{ game, rank } in filteredGames.slice(0, 10)" :key="`top-${rank}`" class="game-row">
            <span class="rank" :class="rank <= 3 ? `rank-${rank}` : undefined">{{ rank }}</span>
            <span class="game-logo">{{ gameIcon(game) }}</span>
            <span class="game-name">
              <strong>{{ game.title }}</strong>
              <small>{{ game.genre }}</small>
            </span>
            <span class="version">
              <span class="version-name">{{ game.version }}</span>
              <small class="version-rate">{{ game.players }}</small>
            </span>
            <span class="rating">
              <span class="rating-value">
                <svg class="vote-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                  <path
                    d="M12 4 L20 12 H15.5 V19 H8.5 V12 H4 Z"
                    fill="url(#voteGrad)"
                  />
                </svg>
                {{ game.stars }}
              </span>
            </span>
          </div>
          <div v-if="filteredGames.length === 0" class="empty-state">{{ $t('panels.empty') }}</div>
          <PanelFooter />
        </GamePanel>

        <GamePanel :title="$t('panels.soon')" class="accent-blue">
          <template #icon>
            <svg class="clock-icon" viewBox="0 0 24 24" width="24" height="24">
              <defs>
                <linearGradient id="clockFace" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#CDEBFF" />
                  <stop offset="45%" stop-color="#5EC2FF" />
                  <stop offset="100%" stop-color="#2F7FE0" />
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="9" fill="url(#clockFace)" />
              <path
                d="M12 6.5v5.5l4 2.3"
                stroke="#0B2A55"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
              <path
                d="M8.3 4.2C6 5.6 4.6 8 4.3 10.7"
                stroke="#EAF6FF"
                stroke-width="1"
                stroke-linecap="round"
                fill="none"
                opacity="0.55"
              />
            </svg>
          </template>
          <div v-for="(game, index) in filteredSoon" :key="`soon-${index}`" class="game-row compact no-rank">
            <span class="game-logo">{{ gameIcon(game) }}</span>
            <span class="game-name">
              <strong>{{ game.title }}</strong>
              <small>{{ game.genre }}</small>
            </span>
            <span class="version">
              <span class="version-name">{{ game.version }}</span>
              <small class="version-rate">{{ game.players }}</small>
            </span>
            <span class="date">
              <span class="date-day">{{ formatDayMonth(game.date) }}</span>
              <small v-if="formatYear(game.date)" class="date-year">{{ formatYear(game.date) }}</small>
            </span>
          </div>
          <div v-if="filteredSoon.length === 0" class="empty-state">{{ $t('panels.empty') }}</div>
          <PanelFooter />
        </GamePanel>

        <GamePanel :title="$t('panels.started')" class="accent-amber">
          <template #icon>
            <svg class="bolt-icon" viewBox="0 0 24 24" width="24" height="24">
              <defs>
                <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FFF3B0" />
                  <stop offset="45%" stop-color="#FFD23F" />
                  <stop offset="100%" stop-color="#F5850B" />
                </linearGradient>
              </defs>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#boltGrad)" />
            </svg>
          </template>
          <div v-for="(game, index) in filteredStarted" :key="`started-${index}`" class="game-row compact no-rank">
            <span class="game-logo">{{ gameIcon(game) }}</span>
            <span class="game-name">
              <strong>{{ game.title }}</strong>
              <small>{{ game.genre }}</small>
            </span>
            <span class="version">
              <span class="version-name">{{ game.version }}</span>
              <small class="version-rate">{{ game.players }}</small>
            </span>
            <span class="date">
              <span class="date-day">{{ formatDayMonth(game.date) }}</span>
              <small v-if="formatYear(game.date)" class="date-year">{{ formatYear(game.date) }}</small>
            </span>
          </div>
          <div v-if="filteredStarted.length === 0" class="empty-state">{{ $t('panels.empty') }}</div>
          <PanelFooter />
        </GamePanel>
      </section>

      <section class="bottom-grid">
        <GamePanel :title="$t('panels.new')" :rows="3" class="accent-violet">
          <template #icon>
            <svg class="sparkle-icon" viewBox="0 0 24 24" width="24" height="24">
              <defs>
                <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FFC2F0" />
                  <stop offset="50%" stop-color="#D06BFF" />
                  <stop offset="100%" stop-color="#7C3AED" />
                </linearGradient>
              </defs>
              <path
                d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
                fill="url(#sparkleGrad)"
              />
            </svg>
          </template>
          <div v-for="(game, index) in filteredNewGames" :key="`new-${index}`" class="game-row compact no-rank">
            <span class="game-logo">{{ gameIcon(game) }}</span>
            <span class="game-name">
              <strong>{{ game.title }}</strong>
              <small>{{ game.genre }}</small>
            </span>
            <span class="version">
              <span class="version-name">{{ game.version }}</span>
              <small class="version-rate">{{ game.players }}</small>
            </span>
            <span class="date">
              <span class="date-day">{{ formatDayMonth(game.date) }}</span>
              <small v-if="formatYear(game.date)" class="date-year">{{ formatYear(game.date) }}</small>
            </span>
          </div>
          <div v-if="filteredNewGames.length === 0" class="empty-state">{{ $t('panels.empty') }}</div>
          <PanelFooter />
        </GamePanel>

        <GamePanel :title="$t('panels.all')" :rows="3" class="accent-teal">
          <template #icon>
            <svg class="grid-icon" viewBox="0 0 24 24" width="24" height="24">
              <defs>
                <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#8FF5D6" />
                  <stop offset="50%" stop-color="#10B981" />
                  <stop offset="100%" stop-color="#0891B2" />
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="7" height="7" rx="1.8" fill="url(#gridGrad)" />
              <rect x="13" y="4" width="7" height="7" rx="1.8" fill="url(#gridGrad)" />
              <rect x="4" y="13" width="7" height="7" rx="1.8" fill="url(#gridGrad)" />
              <rect x="13" y="13" width="7" height="7" rx="1.8" fill="url(#gridGrad)" />
            </svg>
          </template>
          <template #actions>
            <button
              class="shuffle-button"
              type="button"
              :aria-label="$t('panels.shuffle')"
              :style="{ transform: `rotate(${shuffleTurns * 180}deg)` }"
              @click="shuffleGames"
            >
              <svg class="shuffle-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M16 3h5v5" />
                <path d="M4 20 21 3" />
                <path d="M21 16v5h-5" />
                <path d="M15 15l6 6" />
                <path d="M3 4l5 5" />
              </svg>
            </button>
          </template>
          <div v-for="(game, index) in filteredAllGames" :key="`all-${index}`" class="game-row no-rank no-trail">
            <span class="game-logo">{{ gameIcon(game) }}</span>
            <span class="game-name">
              <strong>{{ game.title }}</strong>
              <small>{{ game.genre }}</small>
            </span>
            <span class="version">
              <span class="version-name">{{ game.version }}</span>
              <small class="version-rate">{{ game.players }}</small>
            </span>
          </div>
          <div v-if="filteredAllGames.length === 0" class="empty-state">{{ $t('panels.empty') }}</div>
          <PanelFooter />
        </GamePanel>
      </section>
    </main>
  </div>
</template>
