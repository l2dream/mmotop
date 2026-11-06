// GET /functions/v1/votes-list?server=<id>&key=<secret key>[&since=<vote_id>][&format=json]
//
// The other way to reward a vote: instead of MMOTOP sending each vote to the
// owner's address (the postback), the game server reads this list by itself,
// as often as it likes, and rewards whom it finds. One line per vote with a
// nickname, oldest first:
//
//   vote_id;voted_at;nickname
//   1042;2026-11-06T10:15:02.123Z;Dreamer
//
// Without since: the last 24 hours. With since: only votes after that
// vote_id (the last one the server has handled), up to 1000 at a time. The
// key is the server's secret key from the account page (server_postbacks),
// so only its owner's server can read it. Nicknames cannot hold ";".
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})

const text = (status: number, body: string) => new Response(body, {
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
})

/** Equal strings, compared in constant time. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return text(405, 'GET only\n')
  const url = new URL(req.url)
  const serverId = url.searchParams.get('server') ?? ''
  const key = url.searchParams.get('key') ?? ''
  const since = url.searchParams.get('since')
  if (!serverId || !key || (since !== null && !/^\d{1,18}$/.test(since))) return text(400, 'bad request\n')

  const { data: pb } = await admin.from('server_postbacks').select('secret').eq('server_id', serverId).maybeSingle()
  if (!pb || !same(pb.secret, key)) return text(403, 'wrong server or key\n')

  let query = admin.from('votes').select('id, created_at, nickname')
    .eq('server_id', serverId).not('nickname', 'is', null).is('annulment_id', null).order('id').limit(1000)
  query = since !== null
    ? query.gt('id', since)
    : query.gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  const { data, error } = await query
  if (error) return text(500, 'failed\n')

  const rows = data ?? []
  if (url.searchParams.get('format') === 'json') {
    return new Response(JSON.stringify(rows.map((r) => ({ vote_id: r.id, voted_at: new Date(r.created_at).toISOString(), nickname: r.nickname }))), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    })
  }
  return text(200, rows.map((r) => `${r.id};${new Date(r.created_at).toISOString()};${r.nickname}\n`).join(''))
})
