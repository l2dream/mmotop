// POST /functions/v1/vote  { server_id, nickname?, captcha }
//
// One vote per IP per server per VOTE_HOURS, behind a Cloudflare Turnstile
// captcha. The IP is stored only as a salted hash. When the server's owner has
// switched the reward on, the voter's in-game nickname is sent on to the
// owner's postback URL, signed, so the game server can grant the bonus.
//
// Secrets (supabase secrets set …): TURNSTILE_SECRET, VOTE_SALT.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'

const VOTE_HOURS = 12
const NICK = /^[\p{L}\p{N}_\-. ]{2,32}$/u

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
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
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)

  let input: { server_id?: string, nickname?: string, captcha?: string }
  try { input = await req.json() } catch { return json(req, { error: 'bad_request' }, 400) }

  const serverId = String(input.server_id ?? '')
  const nickname = input.nickname ? String(input.nickname).trim() : ''
  if (!serverId) return json(req, { error: 'bad_request' }, 400)
  if (nickname && !NICK.test(nickname)) return json(req, { error: 'bad_nickname' }, 400)

  const ip = clientIp(req)
  if (!(await captchaPasses(String(input.captcha ?? ''), ip))) return json(req, { error: 'captcha' }, 403)

  const { data: server } = await admin.from('servers').select('id, status').eq('id', serverId).maybeSingle()
  if (!server || server.status !== 'approved') return json(req, { error: 'no_server' }, 404)

  const ipHash = await sha256Hex(`${Deno.env.get('VOTE_SALT') ?? ''}:${ip}`)
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
      const payload = { server_id: serverId, nickname, vote_id: vote.id, voted_at: vote.created_at }
      const signature = await hmacHex(pb.secret, `${serverId}:${nickname}:${vote.id}:${vote.created_at}`)
      try {
        const res = await fetch(pb.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-MMOTOP-Signature': signature },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        })
        postback = res.status
      } catch {
        postback = 0
      }
      await admin.from('votes').update({ postback_status: postback }).eq('id', vote.id)
    }
  }

  return json(req, { ok: true, next_vote_at: new Date(Date.now() + VOTE_HOURS * 3600_000).toISOString(), rewarded: postback !== null && postback >= 200 && postback < 300 })
})
