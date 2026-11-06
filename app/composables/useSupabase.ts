import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The Supabase project behind accounts and servers (see supabase/README.md).
 *
 * The publishable key is meant to sit in the page: it identifies the project
 * and nothing more. What a visitor may read or write is decided by Row Level
 * Security in the database, not by keeping this key out of sight.
 */
export const SUPABASE_URL = 'https://xpfgjhyuompskzxsmwrc.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_m0WmMLZtsVOpcn_pjJQLmA_0UFch4QJ'

/**
 * Where the session is kept in localStorage. Named outright rather than left
 * to the library's default, so the header can tell a signed-in visitor from
 * this key alone without loading the library on every page.
 */
export const AUTH_STORAGE_KEY = 'mmotop-auth'

/**
 * The Telegram bot behind "Sign in with Telegram" (its username, no @). Empty
 * until the owner has made the bot (@BotFather, /setdomain mmotop.com) and
 * put its token into the functions' secrets as TELEGRAM_BOT_TOKEN; until
 * then the Telegram buttons stay hidden.
 */
export const TELEGRAM_BOT = 'mmotop_login_bot'

/** Where the Edge Functions answer: /vote, /telegram-auth, /qr-login. */
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

/**
 * "Someone else's computer": the session is kept in sessionStorage instead,
 * gone when the tab closes. The choice itself sits in sessionStorage too, so
 * it lasts as long as that session and no longer.
 */
const TEMP_KEY = 'mmotop-auth-temp'

function tempSignIn() {
  try {
    return sessionStorage.getItem(TEMP_KEY) === '1'
  } catch {
    return false
  }
}

export function setTempSignIn(on: boolean) {
  try {
    if (on) sessionStorage.setItem(TEMP_KEY, '1')
    else sessionStorage.removeItem(TEMP_KEY)
  } catch {}
}

/** Where the library keeps the session: this tab only, or this browser. */
const storage = {
  getItem: (key: string) => {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (tempSignIn()) {
        sessionStorage.setItem(key, value)
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, value)
      }
    } catch {}
  },
  removeItem: (key: string) => {
    try {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    } catch {}
  }
}

let client: Promise<SupabaseClient> | null = null

/**
 * The client, loaded on first use: the library is some 50 KB, and only the
 * account page needs it. Browser only — the pages are prerendered, and there
 * is no session to speak of at build time.
 */
export function useSupabase() {
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      storage,
      persistSession: true,
      autoRefreshToken: true,
      // The link in the sign-in email lands on the account page with the
      // session in the address; the client picks it up from there.
      detectSessionInUrl: true
    }
  }))
  return client
}

/** Whether a session is stored, read without loading the library. */
export function hasStoredSession() {
  try {
    return !!(sessionStorage.getItem(AUTH_STORAGE_KEY) ?? localStorage.getItem(AUTH_STORAGE_KEY))
  } catch {
    return false
  }
}

/** Shared between the header and the account page. */
export const useSignedIn = () => useState('signed-in', () => false)
