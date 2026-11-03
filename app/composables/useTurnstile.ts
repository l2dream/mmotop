/**
 * Cloudflare Turnstile, the captcha in front of a vote.
 *
 * The site key is public by design (it is in every page that shows the
 * widget); the secret that checks a solved captcha lives in the `vote`
 * function's secrets. The widget's script is loaded the first time someone
 * opens the vote box, not with every page.
 */
const SITE_KEY = '0x4AAAAAAFymAm542YKeKVAU'
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loading: Promise<TurnstileApi> | null = null

function loadTurnstile() {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
    script.onerror = () => {
      loading = null
      reject(new Error('turnstile'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/**
 * Draws the widget into `el` and reports each solved captcha through
 * `onToken` (and `null` when it expires or fails). A token is good for one
 * vote; `reset` asks for a fresh one.
 */
export async function mountTurnstile(el: HTMLElement, onToken: (token: string | null) => void) {
  const api = await loadTurnstile()
  const id = api.render(el, {
    sitekey: SITE_KEY,
    // The site's own theme, not the system's: the light theme is a choice
    // made on the page.
    theme: document.documentElement.classList.contains('theme-light') ? 'light' : 'dark',
    language: 'auto',
    callback: (token: string) => onToken(token),
    'expired-callback': () => onToken(null),
    'error-callback': () => onToken(null)
  })
  return {
    reset: () => {
      onToken(null)
      api.reset(id)
    },
    remove: () => api.remove(id)
  }
}
