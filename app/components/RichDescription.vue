<script setup lang="ts">
/**
 * An owner's description, as written, with what its links point at shown in
 * place: a YouTube link on a line of its own becomes a player, a picture's
 * address on a line of its own becomes the picture, any other address
 * becomes a link. Everything else stays plain text — nothing the owner types
 * is ever read as markup.
 *
 * The player starts as the video's cover with a play button; YouTube's own
 * player (from youtube-nocookie.com, no cookies until it plays) loads only
 * when pressed, so a page with three videos does not load three players.
 *
 * Where YouTube is blocked or throttled (Iran, Russia) the cover does not
 * load: then a plain "Watch on YouTube" link stands in its place. Once
 * playing, a line under the player offers the same link — whether YouTube's
 * own frame loaded cannot be seen from here.
 */
const props = defineProps<{ text: string }>()

type Piece = { kind: 'text', text: string } | { kind: 'link', url: string }
type Block =
  | { kind: 'video', id: string }
  | { kind: 'image', url: string }
  | { kind: 'line', pieces: Piece[] }

const URL_RE = /https?:\/\/[^\s<>"']+/g
const ONLY_URL = /^https?:\/\/\S+$/
const IMAGE = /\.(jpe?g|png|webp|gif|avif)(\?\S*)?$/i

/** The video's id from the usual forms of a YouTube address, or null. */
function youtubeId(url: string) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^(www\.|m\.)/, '')
    let id: string | null = null
    if (host === 'youtu.be') id = u.pathname.slice(1)
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** A line's text with its addresses as links; a full stop or bracket after one stays text. */
function pieces(line: string): Piece[] {
  const out: Piece[] = []
  let at = 0
  for (const m of line.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, '')
    if (m.index! > at) out.push({ kind: 'text', text: line.slice(at, m.index) })
    out.push({ kind: 'link', url })
    at = m.index! + url.length
  }
  if (at < line.length) out.push({ kind: 'text', text: line.slice(at) })
  return out
}

const blocks = computed<Block[]>(() => props.text.split('\n').map((raw) => {
  const line = raw.trim()
  if (ONLY_URL.test(line)) {
    const id = youtubeId(line)
    if (id) return { kind: 'video', id }
    if (line.startsWith('https://') && IMAGE.test(line)) return { kind: 'image', url: line }
  }
  return { kind: 'line', pieces: pieces(raw) }
}))

/** Videos the visitor has pressed play on. */
const playing = ref(new Set<number>())
/** Videos whose cover did not load: YouTube unreachable from here. */
const unreachable = ref(new Set<number>())
const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`
const markUnreachable = (i: number) => { unreachable.value = new Set(unreachable.value).add(i) }

/**
 * The page comes prerendered, so a cover can fail before the page's script
 * is listening for it: once up, the covers that already failed are found.
 */
const root = ref<HTMLElement | null>(null)
onMounted(() => {
  root.value?.querySelectorAll<HTMLImageElement>('img[data-cover]').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) markUnreachable(Number(img.dataset.cover))
  })
})
</script>

<template>
  <div ref="root" class="rich-description">
    <template v-for="(block, i) in blocks" :key="i">
      <!-- A video: the player, or a plain link where YouTube is out of reach. -->
      <template v-if="block.kind === 'video'">
        <a v-if="unreachable.has(i)" class="rich-video-fallback" :href="watchUrl(block.id)" target="_blank" rel="noopener nofollow ugc">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          {{ $t('rich.watchYoutube') }}
        </a>
        <template v-else>
          <div class="rich-video">
            <iframe
              v-if="playing.has(i)"
              :src="`https://www.youtube-nocookie.com/embed/${block.id}?autoplay=1`"
              title="YouTube"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowfullscreen
            />
            <button v-else type="button" class="rich-video-cover" :aria-label="`YouTube ▶`" @click="playing = new Set(playing).add(i)">
              <img :src="`https://i.ytimg.com/vi/${block.id}/hqdefault.jpg`" alt="" loading="lazy" referrerpolicy="no-referrer" :data-cover="i" @error="markUnreachable(i)">
              <span class="rich-video-play" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
              </span>
            </button>
          </div>
          <p v-if="playing.has(i)" class="rich-video-note">
            {{ $t('rich.notLoading') }}
            <a :href="watchUrl(block.id)" target="_blank" rel="noopener nofollow ugc">{{ $t('rich.watchYoutube') }}</a>
          </p>
        </template>
      </template>
      <a v-else-if="block.kind === 'image'" class="rich-image" :href="block.url" target="_blank" rel="noopener nofollow ugc">
        <img :src="block.url" alt="" loading="lazy" referrerpolicy="no-referrer">
      </a>
      <p v-else class="rich-line">
        <template v-for="(piece, j) in block.pieces" :key="j">
          <a v-if="piece.kind === 'link'" :href="piece.url" target="_blank" rel="noopener nofollow ugc" dir="ltr">{{ piece.url }}</a>
          <template v-else>{{ piece.text }}</template>
        </template>
        <br v-if="!block.pieces.length">
      </p>
    </template>
  </div>
</template>
