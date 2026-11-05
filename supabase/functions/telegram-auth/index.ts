// POST /functions/v1/telegram-auth  { …fields from the Telegram Login Widget }
//
// Supabase has no Telegram sign-in of its own. The widget hands the browser
// the visitor's Telegram id, name and a hash signed with our bot's token; this
// checks that hash (https://core.telegram.org/widgets/login#checking-authorization),
// finds the account this Telegram is tied to (profiles.telegram_id) or creates
// one, and returns a one-time token the
// browser exchanges for a normal Supabase session (auth.verifyOtp). With
// link: 1 and a signed-in caller, it ties the Telegram to that account instead.
//
// Secrets: TELEGRAM_BOT_TOKEN. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come
// from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'

const MAX_AGE_S = 24 * 3600

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function validHash(data: Record<string, string>, botToken: string): Promise<boolean> {
  // `link` is ours (see below), not one of Telegram's signed fields.
  const { hash, link: _link, ...fields } = data
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n')
  const secret = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(botToken))
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(check)))
  return !!hash && sig === hash
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)

  let input: Record<string, unknown>
  try { input = await req.json() } catch { return json(req, { error: 'bad_request' }, 400) }
  const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]))

  if (!(await validHash(data, Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''))) return json(req, { error: 'bad_hash' }, 401)
  if (Date.now() / 1000 - Number(data.auth_date) > MAX_AGE_S) return json(req, { error: 'expired' }, 401)

  const telegramId = Number(data.id)

  // Linking: a signed-in owner ties this Telegram to their account, so that
  // signing in with it later opens the same account (with its servers).
  if (data.link === '1') {
    const jwt = req.headers.get('authorization')?.replace(/^Bearer /, '')
    const { data: who } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } }
    if (!who.user) return json(req, { error: 'signed_out' }, 401)
    const { data: other } = await admin.from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle()
    if (other && other.id !== who.user.id) return json(req, { error: 'taken' }, 409)
    const { error } = await admin.from('profiles').update({ telegram_id: telegramId }).eq('id', who.user.id)
    return error ? json(req, { error: 'failed' }, 500) : json(req, { linked: true })
  }

  // Signing in: the account this Telegram is tied to, or else a new one.
  // Telegram gives no email; a new account gets a stable placeholder address
  // under a domain we own, never mailed to.
  let email: string | undefined
  const { data: linked } = await admin.from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle()
  if (linked) {
    const { data: found } = await admin.auth.admin.getUserById(linked.id)
    email = found.user?.email
  }
  if (!email) {
    email = `tg${data.id}@telegram.mmotop.com`
    const meta = {
      full_name: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username,
      user_name: data.username,
      avatar_url: data.photo_url,
      telegram_id: data.id,
      provider: 'telegram'
    }
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta })
    if (created.error && !/already/i.test(created.error.message)) return json(req, { error: 'failed' }, 500)
    if (created.data.user) await admin.from('profiles').update({ telegram_id: telegramId }).eq('id', created.data.user.id)
  }

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error || !link.data.properties?.hashed_token) return json(req, { error: 'failed' }, 500)

  return json(req, { token_hash: link.data.properties.hashed_token, type: 'magiclink' })
})
