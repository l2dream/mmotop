// GET  /functions/v1/vote               → an ALTCHA challenge (JSON)
// POST /functions/v1/vote  { server_id, nickname?, altcha, captcha? }
//
// One vote per IP per server per VOTE_HOURS. In front of it, ALTCHA: a small
// proof of work the visitor's browser solves by itself in a second or two,
// served from here rather than by a third party, so it works wherever the
// site does (Cloudflare's Turnstile is throttled in Russia and patchy in
// Iran). A solved challenge counts once (altcha_used). Only a vote that looks
// suspicious — a burst of votes for the server, or one address voting for
// many servers — also needs a Turnstile captcha ({ error: 'need_captcha' }
// until it comes with one). The IP is stored only as a salted hash. When the server's owner has
// switched the reward on, the voter's in-game nickname is sent on to the
// owner's postback URL, signed, so the game server can grant the bonus.
//
// Secrets (supabase secrets set …): TURNSTILE_SECRET, VOTE_SALT (the ALTCHA
// signing keys are derived from it).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'
import { retryDelay, sendPostback, shouldRetry } from '../_shared/postback.ts'
import { createChallenge, randomInt, verifySolution } from 'npm:altcha-lib@2.8.0'
import { deriveKey } from 'npm:altcha-lib@2.8.0/algorithms/pbkdf2'

const VOTE_HOURS = 12
const NICK = /^[\p{L}\p{N}_\-. ]{2,32}$/u

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})

/** The ALTCHA keys, from VOTE_SALT, so no secret of its own is needed. */
const SALT = Deno.env.get('VOTE_SALT') ?? ''
const ALTCHA = { hmacSignatureSecret: `altcha-signature:${SALT}`, hmacKeySignatureSecret: `altcha-key:${SALT}` }

/**
 * About a second or two on a phone, a fraction on a computer: too little
 * for a person to notice, a cost for a script casting thousands.
 */
function newChallenge() {
  return createChallenge({
    algorithm: 'PBKDF2/SHA-256', cost: 1000, counter: randomInt(1000, 3000),
    deriveKey, expiresAt: new Date(Date.now() + 10 * 60_000), ...ALTCHA
  })
}

/** Whether the widget's payload is a solved, unexpired challenge of ours not used before; marks it used. */
async function altchaPasses(payload: unknown): Promise<boolean> {
  if (typeof payload !== 'string' || payload.length > 4000) return false
  let parsed: { challenge?: { parameters?: unknown, signature?: string }, solution?: unknown }
  try { parsed = JSON.parse(atob(payload)) } catch { return false }
  if (!parsed.challenge?.signature || !parsed.solution) return false
  const result = await verifySolution({ challenge: parsed.challenge as never, solution: parsed.solution as never, deriveKey, ...ALTCHA }).catch(() => null)
  if (!result?.verified) return false
  const { error } = await admin.from('altcha_used').insert({ signature: parsed.challenge.signature })
  if (error) return false
  await admin.from('altcha_used').delete().lt('used_at', new Date(Date.now() - 86400_000).toISOString())
  return true
}

/** Limits past which a vote also needs Turnstile. */
const BURST_VOTES = 20 // for one server within ten minutes
const SPREAD_SERVERS = 5 // from one address within an hour

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function clientIp(req: Request): string {
  // The platform's proxy puts the visitor first in x-forwarded-for.
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || req.headers.get('x-real-ip') || 'unknown'
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method === 'GET') return json(req, await newChallenge())
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)

  let input: { server_id?: string, nickname?: string, captcha?: string, altcha?: string }
  try { input = await req.json() } catch { return json(req, { error: 'bad_request' }, 400) }

  const serverId = String(input.server_id ?? '')
  const nickname = input.nickname ? String(input.nickname).trim() : ''
  if (!serverId) return json(req, { error: 'bad_request' }, 400)
  if (nickname && !NICK.test(nickname)) return json(req, { error: 'bad_nickname' }, 400)

  const ip = clientIp(req)
  const { data: server } = await admin.from('servers').select('id, status').eq('id', serverId).maybeSingle()
  if (!server || server.status !== 'approved') return json(req, { error: 'no_server' }, 404)
  const ipHash = await sha256Hex(`${Deno.env.get('VOTE_SALT') ?? ''}:${ip}`)

  // A Turnstile captcha, when one came, is checked first; then ALTCHA, and
  // for a suspicious vote the captcha is required on top.
  const hasCaptcha = !!input.captcha
  if (hasCaptcha && !(await captchaPasses(String(input.captcha), ip))) return json(req, { error: 'captcha' }, 403)
  if (!hasCaptcha) {
    if (!(await altchaPasses(input.altcha))) return json(req, { error: 'altcha' }, 403)
    const tenMinutes = new Date(Date.now() - 10 * 60_000).toISOString()
    const hour = new Date(Date.now() - 3600_000).toISOString()
    const [{ count: burst }, { data: spread }] = await Promise.all([
      admin.from('votes').select('id', { count: 'exact', head: true }).eq('server_id', serverId).gte('created_at', tenMinutes),
      admin.from('votes').select('server_id').eq('ip_hash', ipHash).gte('created_at', hour).limit(50)
    ])
    const servers = new Set((spread ?? []).map((v) => v.server_id))
    if ((burst ?? 0) >= BURST_VOTES || servers.size >= SPREAD_SERVERS) return json(req, { error: 'need_captcha' }, 403)
  }

  const since = new Date(Date.now() - VOTE_HOURS * 3600_000).toISOString()
  const { data: recent } = await admin.from('votes').select('created_at')
    .eq('server_id', serverId).eq('ip_hash', ipHash).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1)
  if (recent && recent.length) {
    const next = new Date(new Date(recent[0]!.created_at).getTime() + VOTE_HOURS * 3600_000)
    return json(req, { error: 'too_soon', next_vote_at: next.toISOString() }, 429)
  }

  // Who is voting, if they are signed in — optional.
  let userId: string | null = null
  const auth = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (auth) {
    const { data } = await admin.auth.getUser(auth)
    userId = data.user?.id ?? null
  }

  const { data: vote, error } = await admin.from('votes')
    .insert({ server_id: serverId, ip_hash: ipHash, nickname: nickname || null, user_id: userId })
    .select('id, created_at').single()
  if (error || !vote) return json(req, { error: 'failed' }, 500)

  // The reward: tell the game server, signed with the owner's secret.
  let postback: number | null = null
  if (nickname) {
    const { data: pb } = await admin.from('server_postbacks').select('url, secret, enabled').eq('server_id', serverId).maybeSingle()
    if (pb?.enabled && pb.url) {
      postback = await sendPostback(admin, { url: pb.url, secret: pb.secret }, { server_id: serverId, nickname, vote_id: vote.id, voted_at: vote.created_at })
      await admin.from('votes').update({ postback_status: postback }).eq('id', vote.id)
      // Not taken: tried again in a minute, and a few times after.
      if (shouldRetry(postback)) {
        await admin.from('postback_retries').insert({
          vote_id: vote.id, server_id: serverId, nickname, voted_at: vote.created_at,
          attempts: 1, next_at: new Date(Date.now() + retryDelay(1)! * 60_000).toISOString()
        })
      }
    }
  }

  return json(req, { ok: true, next_vote_at: new Date(Date.now() + VOTE_HOURS * 3600_000).toISOString(), rewarded: postback !== null && postback >= 200 && postback < 300 })
})
