// GET  /functions/v1/email-login              → an ALTCHA challenge (JSON)
// POST /functions/v1/email-login  { email, redirect, altcha?, captcha? }
//
// The sign-in letter (a link and a code), sent only for a visitor who passed
// a check — the same two as the vote's:
//
// - ALTCHA, a small proof of work the browser solves by itself, served from
//   here, so it works wherever the site does (Cloudflare's Turnstile is
//   throttled in Russia and does not load in some sanctioned regions);
// - Turnstile on top, only when the request looks like a bot's: several
//   letters from one address or one network within the hour, or an address
//   of a data centre or VPN (dc_ranges). Answered { error: 'need_captcha' }
//   until it comes with one.
//
// From 19 November 2026 a bot typed strangers' addresses into the form,
// twenty or thirty a day. Supabase's own captcha (Auth → Attack Protection,
// Turnstile) stays on: it shuts the public way to /auth/v1/otp, which anyone
// holding the site's public key could call around this function. The letter
// is asked for here with the service role, which that captcha does not
// apply to, and goes out as before, through the project's mail (Resend).
//
// Secrets: TURNSTILE_SECRET, VOTE_SALT (the ALTCHA keys are derived from
// it). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'
import { createChallenge, randomInt, verifySolution } from 'npm:altcha-lib@2.8.0'
import { deriveKey } from 'npm:altcha-lib@2.8.0/algorithms/pbkdf2'

const URL_ = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })

const SALT = Deno.env.get('VOTE_SALT') ?? ''
const ALTCHA = { hmacSignatureSecret: `altcha-signature:${SALT}`, hmacKeySignatureSecret: `altcha-key:${SALT}` }

/** Past these, within an hour, a letter also needs Turnstile. */
const PER_ADDRESS = 3
const PER_NETWORK = 8

/** Where the letter's link may lead: the site's own account page. */
const REDIRECT = /^(https:\/\/mmotop\.com|http:\/\/localhost:(3000|4175))\/([a-z]{2}(-[a-z]{2})?\/)?account\/(\?approve=[\w.-]+)?$/
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/

function newChallenge() {
  return createChallenge({
    algorithm: 'PBKDF2/SHA-256', cost: 1000, counter: randomInt(1000, 3000),
    deriveKey, expiresAt: new Date(Date.now() + 10 * 60_000), ...ALTCHA
  })
}

/** A solved, unexpired challenge of ours not used before; marks it used. */
async function altchaPasses(payload: unknown): Promise<boolean> {
  if (typeof payload !== 'string' || payload.length > 4000) return false
  let parsed: { challenge?: { signature?: string }, solution?: unknown }
  try { parsed = JSON.parse(atob(payload)) } catch { return false }
  if (!parsed.challenge?.signature || !parsed.solution) return false
  const result = await verifySolution({ challenge: parsed.challenge as never, solution: parsed.solution as never, deriveKey, ...ALTCHA }).catch(() => null)
  if (!result?.verified) return false
  const { error } = await admin.from('altcha_used').insert({ signature: parsed.challenge.signature })
  return !error
}

async function captchaPasses(token: string, ip: string): Promise<boolean> {
  const body = new FormData()
  body.append('secret', Deno.env.get('TURNSTILE_SECRET') ?? '')
  body.append('response', token)
  body.append('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
  const out = await res.json().catch(() => ({}))
  return out.success === true
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || req.headers.get('x-real-ip') || 'unknown'
}

/** The address's network: /24 for IPv4, /48 for IPv6. */
function subnetOf(ip: string): string {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.split('.').slice(0, 3).join('.') + '.0/24'
  if (ip.includes(':')) {
    const [head = '', tail = ''] = ip.split('::')
    const left = head ? head.split(':') : []
    const right = tail ? tail.split(':') : []
    const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left
    return groups.slice(0, 3).map((g) => parseInt(g || '0', 16).toString(16)).join(':') + '::/48'
  }
  return ip
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method === 'GET') return json(req, await newChallenge())
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)

  let input: { email?: string, redirect?: string, altcha?: string, captcha?: string }
  try { input = await req.json() } catch { return json(req, { error: 'bad_request' }, 400) }
  const email = String(input.email ?? '').trim().toLowerCase()
  const redirect = String(input.redirect ?? '')
  if (email.length > 254 || !EMAIL.test(email) || !REDIRECT.test(redirect)) return json(req, { error: 'bad_request' }, 400)

  const ip = clientIp(req)
  const ipHash = await sha256Hex(`${SALT}:login:${ip}`)
  const netHash = await sha256Hex(`${SALT}:login-net:${subnetOf(ip)}`)

  if (input.captcha) {
    if (!(await captchaPasses(String(input.captcha), ip))) return json(req, { error: 'captcha' }, 403)
  } else {
    if (!(await altchaPasses(input.altcha))) return json(req, { error: 'altcha' }, 403)
    const hour = new Date(Date.now() - 3600_000).toISOString()
    const [{ count: fromIp }, { count: fromNet }, { data: datacenter }] = await Promise.all([
      admin.from('email_login_log').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', hour),
      admin.from('email_login_log').select('id', { count: 'exact', head: true }).eq('net_hash', netHash).gte('created_at', hour),
      admin.rpc('is_datacenter_ip', { p_ip: ip })
    ])
    if (datacenter === true || (fromIp ?? 0) >= PER_ADDRESS || (fromNet ?? 0) >= PER_NETWORK) {
      return json(req, { error: 'need_captcha' }, 403)
    }
  }

  // The letter, asked of Supabase Auth with the service role.
  const res = await fetch(`${URL_}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true })
  })
  if (res.status === 429) return json(req, { error: 'too_many' }, 429)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('otp', res.status, body.slice(0, 300))
    return json(req, { error: 'failed' }, 502)
  }

  await admin.from('email_login_log').insert({ ip_hash: ipHash, net_hash: netHash })
  await admin.from('email_login_log').delete().lt('created_at', new Date(Date.now() - 86400_000).toISOString())
  return json(req, { ok: true })
})
