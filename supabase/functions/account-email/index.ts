// POST /functions/v1/account-email  { action: 'send', email } | { action: 'confirm', code }
//
// Gives an account made with Telegram (a placeholder address, never mailed)
// a real email: 'send' mails a six-digit code to the new address (in the
// owner's language, through Resend), 'confirm' checks it and sets the
// account's email, confirmed. From then on the account can sign in by email,
// Google and Discord with that address are the same account, and Telegram
// can be unlinked. An address another account has is refused.
//
// One code at a time per account, a new one at most once a minute, five
// tries, thirty minutes. Secrets: RESEND_API_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'
import MESSAGES from './messages.json' with { type: 'json' }

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
const PLACEHOLDER = '@telegram.mmotop.com'
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const hash = async (uid: string, code: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${uid}:${code}`)))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)
  let input: { action?: string, email?: string, code?: string }
  try { input = await req.json() } catch { return json(req, { error: 'bad_request' }, 400) }

  const jwt = req.headers.get('authorization')?.replace(/^Bearer /, '')
  const { data: who } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } }
  const user = who.user
  if (!user) return json(req, { error: 'signed_out' }, 401)
  if (!user.email?.endsWith(PLACEHOLDER)) return json(req, { error: 'has_email' }, 409)

  if (input.action === 'send') {
    const email = String(input.email ?? '').trim().toLowerCase()
    if (!EMAIL.test(email) || email.endsWith(PLACEHOLDER)) return json(req, { error: 'bad_email' }, 400)
    const { data: taken } = await admin.rpc('email_taken', { p_email: email, p_except: user.id })
    if (taken) return json(req, { error: 'taken' }, 409)
    const { data: last } = await admin.from('email_claims').select('sent_at').eq('user_id', user.id).maybeSingle()
    if (last && Date.now() - new Date(last.sent_at).getTime() < 60_000) return json(req, { error: 'too_soon' }, 429)

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0')
    await admin.from('email_claims').upsert({
      user_id: user.id, email, code_hash: await hash(user.id, code), attempts: 0,
      sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 60_000).toISOString()
    })
    const { data: profile } = await admin.from('profiles').select('locale').eq('id', user.id).maybeSingle()
    const words = (MESSAGES as Record<string, { subject: string, text: string }>)[profile?.locale ?? 'en'] ?? MESSAGES.en
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}` },
      body: JSON.stringify({
        from: 'MMOTOP <noreply@mmotop.com>', reply_to: 'support@mmotop.com', to: [email],
        subject: words.subject, text: words.text.replace('{code}', code)
      })
    }).catch(() => null)
    return res?.ok ? json(req, { sent: true }) : json(req, { error: 'failed' }, 500)
  }

  if (input.action === 'confirm') {
    const { data: claim } = await admin.from('email_claims').select('*').eq('user_id', user.id).maybeSingle()
    if (!claim || new Date(claim.expires_at).getTime() < Date.now() || claim.attempts >= 5) return json(req, { error: 'wrong_code' }, 400)
    await admin.from('email_claims').update({ attempts: claim.attempts + 1 }).eq('user_id', user.id)
    if (claim.code_hash !== (await hash(user.id, String(input.code ?? '').replace(/\s+/g, '')))) return json(req, { error: 'wrong_code' }, 400)

    const { error } = await admin.auth.admin.updateUserById(user.id, { email: claim.email, email_confirm: true })
    if (error) return json(req, { error: /already|exists|registered/i.test(error.message) ? 'taken' : 'failed' }, error.status === 422 ? 409 : 500)
    await admin.from('email_claims').delete().eq('user_id', user.id)
    return json(req, { added: true })
  }

  return json(req, { error: 'bad_request' }, 400)
})
