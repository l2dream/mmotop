/**
 * Buttons that are not a "half-open door" stay quiet at rest and light up
 * when used. With a mouse that is :hover; a finger has no hover, so a tap
 * would show nothing — or, worse, leave the button "hovered" and lit until
 * the next tap elsewhere. Instead a tap adds .is-lit for as long as the
 * finger is down and 0.3s after, then takes it off (see main.css, "Design
 * system").
 */
const LIT = '.panel-head .panel-arrow, .shuffle-button, .section-back, .filter-button, .category.more, .account-rate-pm button'
const HOLD = 300

export default defineNuxtPlugin(() => {
  const timers = new WeakMap<Element, number>()
  const target = (event: Event) => (event.target as Element | null)?.closest?.(LIT) ?? null
  // The way back and the More tab light their inner ring, not themselves.
  const ring = (el: Element) => el.matches('.section-back') ? el.querySelector('.section-back-arrow') : el.matches('.category.more') ? el.querySelector('.more-chevron') : el

  document.addEventListener('pointerdown', (event) => {
    if ((event as PointerEvent).pointerType === 'mouse') return
    const el = target(event)
    const lit = el && ring(el)
    if (!lit) return
    clearTimeout(timers.get(lit))
    lit.classList.add('is-lit')
  }, { passive: true })

  const release = (event: Event) => {
    const el = target(event)
    const lit = el && ring(el)
    if (!lit || !lit.classList.contains('is-lit')) return
    clearTimeout(timers.get(lit))
    timers.set(lit, window.setTimeout(() => lit.classList.remove('is-lit'), HOLD))
  }
  document.addEventListener('pointerup', release, { passive: true })
  document.addEventListener('pointercancel', release, { passive: true })
})
