/**
 * The dashboard's UI state, held outside the page component.
 *
 * `/` and `/de` are separate route records, so switching language destroys
 * index.vue and builds it again. Everything the page kept in a local `ref`
 * went with it: a visitor in light mode, with a search typed and three filters
 * set, changed language and got a dark page with none of it — and no
 * explanation, because nothing had gone wrong from their side.
 *
 * `useState` lives in the Nuxt app rather than in the component, so it
 * survives the remount. Everything here is state the visitor set deliberately
 * and would be annoyed to lose; anything the page can recompute belongs in
 * the component as before.
 *
 * This is per-visit on its own. The game, version and rate filters and the
 * search text also live in the address (see "The filters live in the address"
 * in index.vue), so those survive a reload.
 */
export interface RateFilters {
  version: string
  rates: string[]
}

export function useDashboardState() {
  const dark = useState('dash-dark', () => true)
  const query = useState('dash-query', () => '')
  const activeCategory = useState('dash-category', () => 'all')

  const filters = useState<RateFilters>('dash-filters', () => ({
    version: '',
    rates: []
  }))

  const customRateActive = useState('dash-rate-on', () => false)
  const customRateMin = useState('dash-rate-min', () => '')
  const customRateMax = useState('dash-rate-max', () => '')

  return { dark, query, activeCategory, filters, customRateActive, customRateMin, customRateMax }
}
