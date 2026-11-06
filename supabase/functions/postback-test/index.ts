// POST /functions/v1/postback-test  { server_id }   (signed in as its owner)
//
// Sends the server's reward address a notification like a vote's, with the
// nickname TEST, vote_id 0 and "test": true, so the owner can check the
// script on their game server without voting. Uses the saved settings
// (server_postbacks), whether or not the reward is switched on. Answers
// { status }: the server's HTTP status, or 0 if it did not answer.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'
import { sendPostback } from '../_shared/postback.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)

  let input: { server_id?: string }
  try { input = await req.json() } catch { return json(req, { error: 'bad_request' }, 400) }
  const serverId = String(input.server_id ?? '')

  const jwt = req.headers.get('authorization')?.replace(/^Bearer /, '')
  const { data: who } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } }
  if (!who.user) return json(req, { error: 'signed_out' }, 401)

  const { data: server } = await admin.from('servers').select('owner_id').eq('id', serverId).maybeSingle()
  if (!server || server.owner_id !== who.user.id) return json(req, { error: 'no_server' }, 404)

  // One test every ten seconds at most, so the button cannot be used to
  // flood someone's address.
  const { data: recent } = await admin.from('postback_log').select('id').eq('server_id', serverId).eq('test', true)
    .gte('sent_at', new Date(Date.now() - 10_000).toISOString()).limit(1)
  if (recent?.length) return json(req, { error: 'too_soon' }, 429)

  const { data: pb } = await admin.from('server_postbacks').select('url, secret').eq('server_id', serverId).maybeSingle()
  if (!pb?.url) return json(req, { error: 'no_url' }, 400)

  const status = await sendPostback(admin, { url: pb.url, secret: pb.secret },
    { server_id: serverId, nickname: 'TEST', vote_id: 0, voted_at: new Date().toISOString(), test: true })
  return json(req, { status })
})
