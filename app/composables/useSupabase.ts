import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The Supabase project behind accounts and servers (see supabase/README.md).
 *
 * The publishable key is meant to sit in the page: it identifies the project
 * and nothing more. What a visitor may read or write is decided by Row Level
 * Security in the database, not by keeping this key out of sight.
 */
const SUPABASE_URL = 'https://xpfgjhyuompskzxsmwrc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_m0WmMLZtsVOpcn_pjJQLmA_0UFch4QJ'

/**
 * Where the session is kept in localStorage. Named outright rather than left
 * to the library's default, so the header can tell a signed-in visitor from
 * this key alone without loading the library on every page.
 */
export const AUTH_STORAGE_KEY = 'mmotop-auth'

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
    return !!localStorage.getItem(AUTH_STORAGE_KEY)
  } catch {
    return false
  }
}

/** Shared between the header and the account page. */
export const useSignedIn = () => useState('signed-in', () => false)
