// POST /functions/v1/account-delete   (signed in)
//
// Deletes the caller's own account for good: their pictures and logos in
// server-images (their <uid>/ folder), then the account itself, which takes
// the profile, their servers, those servers' votes, reward settings and logs
// with it (foreign keys, on delete cascade). The last admin cannot delete
// themselves, so moderation is never left to nobody.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)

  const jwt = req.headers.get('authorization')?.replace(/^Bearer /, '')
  const { data: who } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } }
  if (!who.user) return json(req, { error: 'signed_out' }, 401)
  const uid = who.user.id

  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', uid).maybeSingle()
  if (me?.is_admin) {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true)
    if ((count ?? 0) <= 1) return json(req, { error: 'last_admin' }, 409)
  }

  // Their files, a hundred at a time.
  const bucket = admin.storage.from('server-images')
  for (;;) {
    const { data: files } = await bucket.list(uid, { limit: 100 })
    if (!files?.length) break
    const { error } = await bucket.remove(files.map((f) => `${uid}/${f.name}`))
    if (error) break
  }

  const { error } = await admin.auth.admin.deleteUser(uid)
  return error ? json(req, { error: 'failed' }, 500) : json(req, { deleted: true })
})
