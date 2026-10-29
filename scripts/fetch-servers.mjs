// Fetches the servers owners added through their account and a moderator
// approved, with this month's votes, for the build to list beside the ones in
// app/data/servers.ts.
//
// Run by .github/workflows/deploy.yml before the build:
//
//   node scripts/fetch-servers.mjs           write app/data/live-servers.json
//                                            and public/live-servers.json
//   node scripts/fetch-servers.mjs --check   only say whether the list differs
//                                            from the one the live site was
//                                            built with (changed=true|false
//                                            into $GITHUB_OUTPUT)
//
// It reads with the site's own publishable key, as any visitor could: Row
// Level Security hands out approved servers and the vote counts, nothing
// else. If the database cannot be reached the script fails, and with it the
// deploy — better the site as it was than one with every listed server gone.

import { appendFile, writeFile } from 'node:fs/promises'

const SUPABASE_URL = 'https://xpfgjhyuompskzxsmwrc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_m0WmMLZtsVOpcn_pjJQLmA_0UFch4QJ'
const SITE = 'https://mmotop.com'

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

const [rows, votes] = await Promise.all([
  rest('servers?select=id,name,game,chronicle,rate,url,open_date,listed_at&status=eq.approved&order=id'),
  rest('server_votes_month?select=server_id,votes')
])
const votesById = new Map(votes.map((v) => [v.server_id, v.votes]))

// The shape of Server in app/data/servers.ts.
const servers = rows.map((r) => ({
  id: r.id,
  name: r.name,
  game: r.game,
  chronicle: r.chronicle,
  ...(r.rate == null ? {} : { rate: Number(r.rate) }),
  url: r.url,
  openDate: r.open_date,
  listedAt: (r.listed_at ?? r.open_date).slice(0, 10),
  votes: votesById.get(r.id) ?? 0
}))
const json = `${JSON.stringify(servers, null, 2)}\n`

if (process.argv.includes('--check')) {
  const live = await fetch(`${SITE}/live-servers.json`, { cache: 'no-store' })
  const changed = !live.ok || (await live.text()) !== json
  console.log(changed ? 'The listed servers changed since the last deploy.' : 'Nothing new.')
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`)
} else {
  await writeFile(new URL('../app/data/live-servers.json', import.meta.url), json)
  // Published beside the site, so the next --check has something to compare.
  await writeFile(new URL('../public/live-servers.json', import.meta.url), json)
  console.log(`${servers.length} listed server(s) from the database.`)
}
