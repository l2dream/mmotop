<script setup lang="ts">
/**
 * A diagnostic readout, shown only with ?debug=scroll in the address.
 *
 * Built to chase a report that on Android Chrome, after the phone has been
 * turned sideways and back, the page slides down a step on every letter typed
 * into the search — which no desktop emulation reproduces. It prints, live,
 * the numbers that distinguish the possible causes: the page's own scroll,
 * the visual viewport's offset and zoom (keyboard and pinch-zoom live there),
 * the page height, and where the search field sits. Each typed letter adds a
 * line showing what moved between the key and the next frame.
 *
 * Fixed, click-through and below the header, so it never takes part in the
 * layout it measures and never covers the search field.
 */
const route = useRoute()
const on = ref(false)
const now = ref('')
const log = ref<string[]>([])

function snapshot() {
  const vv = window.visualViewport
  const input = document.querySelector('.search-box input')
  const r = input?.getBoundingClientRect()
  return {
    y: Math.round(window.scrollY),
    inH: window.innerHeight,
    vvTop: vv ? Math.round(vv.offsetTop) : 0,
    vvPage: vv ? Math.round(vv.pageTop) : 0,
    vvH: vv ? Math.round(vv.height) : 0,
    scale: vv ? +vv.scale.toFixed(2) : 1,
    doc: document.documentElement.scrollHeight,
    cw: document.documentElement.clientWidth,
    inTop: r ? Math.round(r.top) : 0
  }
}

function render() {
  const s = snapshot()
  now.value = `y ${s.y}  inner ${window.innerWidth}x${s.inH}  cw ${s.cw}\nvv h ${s.vvH} top ${s.vvTop} page ${s.vvPage} zoom ${s.scale}\ndoc ${s.doc}  field top ${s.inTop}`
}

function onInput(e: Event) {
  if (!(e.target as HTMLElement).closest('.search-box')) return
  const a = snapshot()
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const b = snapshot()
    const d = (k: keyof typeof a) => (b[k] === a[k] ? '' : ` ${k} ${a[k]}→${b[k]}`)
    const moved = `${d('y')}${d('vvTop')}${d('vvPage')}${d('scale')}${d('doc')}${d('inTop')}${d('vvH')}`
    const line = `key:${moved || ' nothing moved'}`
    log.value = [line, ...log.value].slice(0, 8)
    render()
  }))
}

const events: [EventTarget, string][] = []
function listen(t: EventTarget | null | undefined, name: string) {
  if (!t) return
  t.addEventListener(name, render, { passive: true })
  events.push([t, name])
}

onNuxtReady(() => {
  if (route.query.debug !== 'scroll') return
  on.value = true
  render()
  listen(window, 'scroll'); listen(window, 'resize'); listen(window, 'orientationchange')
  listen(window.visualViewport, 'resize'); listen(window.visualViewport, 'scroll')
  document.addEventListener('input', onInput, true)
})

onUnmounted(() => {
  for (const [t, name] of events) t.removeEventListener(name, render)
  document.removeEventListener('input', onInput, true)
})
</script>

<template>
  <pre v-if="on" class="scroll-debug">{{ now }}
{{ log.join('\n') }}</pre>
</template>

<style scoped>
.scroll-debug {
  position: fixed;
  /* Below the header, so the search field it is watching stays visible. */
  top: 60px;
  left: 4px;
  z-index: 9999;
  max-width: calc(100vw - 8px);
  margin: 0;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, .78);
  color: #7CFC9A;
  font: 10px/1.35 ui-monospace, monospace;
  white-space: pre-wrap;
  pointer-events: none;
}
</style>
