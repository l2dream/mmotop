import { SECTIONS, type SectionId } from '~/data/sections'

/**
 * Which home panels the visitor has switched from a list to a carousel.
 *
 * A per-visitor preference, like the theme, kept in localStorage and mirrored
 * onto <html>: data-carousel names the carousels, and data-wide the panels
 * that take the full width — every carousel, and any list left without a
 * partner of its own length. Lists pair only like with like: the long ones
 * (TOP, SOON, STARTED, ten rows) with each other and the short ones (NEW,
 * ALL, three rows) with each other, so a short panel never stands beside a
 * long one over an empty half. The page draws both the list and the carousel, and
 * CSS shows one from those attributes. An inline script in app.vue (BOOT,
 * below) sets them before the first paint, so a panel left as a carousel
 * comes back as one without the list showing for a moment first.
 *
 * Storage can be unavailable (private modes); then the switch still works,
 * for the visit.
 */
export const CAROUSEL_KEY = 'mmotop-carousel'

/** Panels of the same length, which may share a row. */
const LENGTHS: SectionId[][] = [['top', 'soon', 'started'], ['new', 'all']]

/** The attributes from the stored value; the same rule as wide() below. */
export const CAROUSEL_BOOT = `try{var c=(localStorage.getItem('${CAROUSEL_KEY}')||'').split(' ').filter(Boolean);if(c.length){var w=c.slice();${JSON.stringify(LENGTHS)}.forEach(function(g){var l=g.filter(function(i){return c.indexOf(i)<0});if(l.length%2)w.push(l[l.length-1])});var d=document.documentElement.dataset;d.carousel=c.join(' ');d.wide=w.join(' ')}}catch(e){}`

function wide(ids: SectionId[]): SectionId[] {
  const out = [...ids]
  for (const group of LENGTHS) {
    const lists = group.filter((s) => !ids.includes(s))
    if (lists.length % 2) out.push(lists[lists.length - 1]!)
  }
  return out
}

export function useCarouselPanels() {
  const ids = useState<SectionId[]>('dash-carousel', () => [])

  function read() {
    const raw = document.documentElement.dataset.carousel ?? ''
    ids.value = raw.split(' ').filter(Boolean) as SectionId[]
  }

  function toggle(id: SectionId) {
    const next = ids.value.includes(id) ? ids.value.filter((x) => x !== id) : [...ids.value, id]
    // Kept in the panels' own order, so the stored value reads the same
    // however the switches were pressed.
    ids.value = SECTIONS.filter((s) => next.includes(s))
    const data = document.documentElement.dataset
    if (ids.value.length) {
      data.carousel = ids.value.join(' ')
      data.wide = wide(ids.value).join(' ')
    } else {
      delete data.carousel
      delete data.wide
    }
    try {
      if (ids.value.length) localStorage.setItem(CAROUSEL_KEY, ids.value.join(' '))
      else localStorage.removeItem(CAROUSEL_KEY)
    } catch {}
  }

  return { ids, read, toggle }
}
