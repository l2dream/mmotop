// POST /functions/v1/notify-owner  { server_id }
//
// Tells a server's owner what the moderator decided — approved, rejected
// (with the reason, if one was given) or hidden — in the owner's language
// (profiles.locale, set by the account page): by Telegram if they linked it
// (the sign-in bot may write to those who signed in with it), and by email
// from noreply@mmotop.com through Resend if RESEND_API_KEY is set.
//
// Called by the database (servers_notify_owner, through pg_net) when the
// status changes. Anyone may call it: it tells the owner only of the status
// the server has now, and only once (servers.notified_status).
//
// Secrets: TELEGRAM_BOT_TOKEN, RESEND_API_KEY (optional). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY come from the platform.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders, json } from '../_shared/cors.ts'
import MESSAGES from './messages.json' with { type: 'json' }

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
})
const SITE = 'https://mmotop.com'
type Words = (typeof MESSAGES)['en']
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '')

/** The chronicle's part of a page address, as the site makes it (data/games.ts); '' when it has no Latin to go on. */
const versionSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405)
  let input: { server_id?: string }
  try { input = await req.json() } catch { return json(req, { error: 'bad_request' }, 400) }

  const { data: s } = await admin.from('servers')
    .select('id, name, game, chronicle, status, moderation_note, notified_status, owner_id')
    .eq('id', String(input.server_id ?? '')).maybeSingle()
  if (!s || !['approved', 'rejected', 'hidden'].includes(s.status) || s.notified_status === s.status) return json(req, { sent: false })

  // Claimed first, so two calls at once do not both send.
  const { data: claimed } = await admin.from('servers').update({ notified_status: s.status })
    .eq('id', s.id).eq('status', s.status).or(`notified_status.is.null,notified_status.neq.${s.status}`)
    .select('id')
  if (!claimed?.length) return json(req, { sent: false })

  const { data: profile } = await admin.from('profiles').select('locale, telegram_id').eq('id', s.owner_id).maybeSingle()
  const { data: owner } = await admin.auth.admin.getUserById(s.owner_id)
  const locale = profile?.locale ?? 'en'
  const words: Words = (MESSAGES as Record<string, Words>)[locale] ?? MESSAGES.en
  const prefix = locale === 'en' ? '' : `/${locale}`
  const cabinet = `${SITE}${prefix}/account/`
  const slug = versionSlug(s.chronicle)
  const page = slug ? `${SITE}${prefix}/${s.game}/${slug}/${s.id}/` : cabinet

  const lines = [fill(words[s.status as 'approved' | 'rejected' | 'hidden'], { name: s.name })]
  if (s.status !== 'approved' && s.moderation_note) lines.push(fill(words.reason, { note: s.moderation_note }))
  lines.push(s.status === 'approved' ? fill(words.soon, { url: page }) : fill(words.cabinet, { url: cabinet }))
  const text = lines.join('\n\n')

  const sent: string[] = []
  const bot = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (bot && profile?.telegram_id) {
    const res = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: profile.telegram_id, text, disable_web_page_preview: true })
    }).catch(() => null)
    if (res?.ok) sent.push('telegram')
  }
  const resend = Deno.env.get('RESEND_API_KEY')
  const email = owner.user?.email
  if (resend && email && !email.endsWith('@telegram.mmotop.com')) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resend}` },
      body: JSON.stringify({ from: 'MMOTOP <noreply@mmotop.com>', to: [email], subject: lines[0], text })
    }).catch(() => null)
    if (res?.ok) sent.push('email')
  }
  return json(req, { sent })
})
