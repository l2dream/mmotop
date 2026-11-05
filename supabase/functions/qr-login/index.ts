// POST /functions/v1/qr-login  { action, id?, secret? }
//
// Signing in on a computer with the phone, without opening one's mail there:
//
//   start    (the computer)  → { id, secret, code }: a request good for five
//            minutes. The computer shows https://mmotop.com/account/?approve=
//            <id>.<secret> as a QR code, and the four-digit code beside it.
//   peek     (the phone, signed in) → { code }: the same four digits, for the
//            owner to compare before approving.
//   approve  (the phone, signed in) → { ok }: the request is the phone's
//            account's now.
//   poll     (the computer, every couple of seconds) → { pending } until
//            approved, then once { token_hash, type }, which the browser
//            exchanges for a session (auth.verifyOtp), like telegram-auth.
//
// Only this function touches login_requests (service role). The secret is
// stored hashed; a request is used once.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})

const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
const UUID = /^[0-9a-f-]{36}$/

/** The request, if the secret is its own and it is still good. */
async function request(id: unknown, secret: unknown) {
  if (typeof id !== 'string' || !UUID.test(id) || typeof secret !== 'string' || secret.length !== 48) return null
  const { data } = await admin.from('login_requests').select('*').eq('id', id).maybeSingle()
  if (!data || data.secret_hash !== (await sha256(secret)) || data.consumed || new Date(data.expires_at).getTime() < Date.now()) return null
  return data
}

/** The signed-in account behind the call, if any. */
async function caller(req: Request) {
  const jwt = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!jwt) return null
  const { data } = await admin.auth.getUser(jwt)
  return data.user ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)

  let input: { action?: string, id?: string, secret?: string }
  try { input = await req.json() } catch { return json(req, { error: 'bad_request' }, 400) }

  if (input.action === 'start') {
    // Old requests go as new ones come.
    await admin.from('login_requests').delete().lt('expires_at', new Date(Date.now() - 3600_000).toISOString())
    const secret = hex(crypto.getRandomValues(new Uint8Array(24)))
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 10000).padStart(4, '0')
    const { data, error } = await admin.from('login_requests')
      .insert({ secret_hash: await sha256(secret), code }).select('id').single()
    if (error || !data) return json(req, { error: 'failed' }, 500)
    return json(req, { id: data.id, secret, code })
  }

  const row = await request(input.id, input.secret)
  if (!row) return json(req, { error: 'expired' }, 410)

  if (input.action === 'peek' || input.action === 'approve') {
    const user = await caller(req)
    if (!user) return json(req, { error: 'signed_out' }, 401)
    if (input.action === 'peek') return json(req, { code: row.code })
    if (row.approved_user) return json(req, { error: 'expired' }, 410)
    await admin.from('login_requests').update({ approved_user: user.id }).eq('id', row.id)
    return json(req, { ok: true })
  }

  if (input.action === 'poll') {
    if (!row.approved_user) return json(req, { pending: true })
    // Used once: whatever happens next, this request is spent — and only the
    // first of two polls racing each other gets past this.
    const { data: spent } = await admin.from('login_requests').update({ consumed: true })
      .eq('id', row.id).eq('consumed', false).select('id')
    if (!spent?.length) return json(req, { error: 'expired' }, 410)
    const { data: found } = await admin.auth.admin.getUserById(row.approved_user)
    const email = found.user?.email
    if (!email) return json(req, { error: 'failed' }, 500)
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error || !link.data.properties?.hashed_token) return json(req, { error: 'failed' }, 500)
    return json(req, { token_hash: link.data.properties.hashed_token, type: 'magiclink' })
  }

  return json(req, { error: 'bad_request' }, 400)
})
