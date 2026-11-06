// POST /functions/v1/postback-retry   (called every minute by pg_cron, only
// when something is due; see the postback_retries migration)
//
// Sends again the reward notifications the game servers did not take, the
// same as the first time (same vote_id and voted_at, same signature), after
// 1, 5, 15 and 40 minutes, then gives up. It stops early once the server
// takes it, refuses it outright (a 4xx other than 429), or the owner has
// switched the reward off or removed the address.
//
// Anyone may call it: it only sends what is due anyway, and each row is
// claimed before sending, so two calls at once do not send twice.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'
import { retryDelay, sendPostback, shouldRetry } from '../_shared/postback.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)

  const now = new Date()
  const { data: due } = await admin.from('postback_retries').select('*')
    .lte('next_at', now.toISOString()).order('next_at').limit(50)

  let sent = 0
  for (const row of due ?? []) {
    // Claimed: pushed ten minutes on, only if nobody else got to it first.
    const { data: claimed } = await admin.from('postback_retries')
      .update({ next_at: new Date(now.getTime() + 10 * 60_000).toISOString() })
      .eq('vote_id', row.vote_id).eq('next_at', row.next_at).select('vote_id')
    if (!claimed?.length) continue

    const { data: pb } = await admin.from('server_postbacks').select('url, secret, enabled').eq('server_id', row.server_id).maybeSingle()
    if (!pb?.enabled || !pb.url) {
      await admin.from('postback_retries').delete().eq('vote_id', row.vote_id)
      continue
    }

    const attempt = row.attempts + 1
    const status = await sendPostback(admin, { url: pb.url, secret: pb.secret },
      { server_id: row.server_id, nickname: row.nickname, vote_id: row.vote_id, voted_at: row.voted_at, attempt })
    sent++
    await admin.from('votes').update({ postback_status: status }).eq('id', row.vote_id)

    const delay = retryDelay(attempt)
    if (!shouldRetry(status) || delay == null) {
      await admin.from('postback_retries').delete().eq('vote_id', row.vote_id)
    } else {
      await admin.from('postback_retries')
        .update({ attempts: attempt, next_at: new Date(Date.now() + delay * 60_000).toISOString() })
        .eq('vote_id', row.vote_id)
    }
  }
  return json(req, { sent })
})
