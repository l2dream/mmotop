// Fetches the servers owners added through their account and a moderator
// approved, with this month's votes, for the build to list beside the ones in
// app/data/servers.ts.
//
// Run by .github/workflows/deploy.yml before the build:
//
//   node scripts/fetch-servers.mjs           write app/data/live-servers.json,
//                                            live-moves.json, live-catalog.json
//                                            and their copies
//                                            in public/
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

const [rows, votes, moves, catalog] = await Promise.all([
  rest('servers?select=id,name,game,chronicle,rate,rate_text,url,open_date,listed_at,description,language,language_text,links&status=eq.approved&order=id'),
  rest('server_votes_month?select=server_id,votes'),
  // Addresses servers had before their owner changed them, for the build to
  // send on to the new ones (OLD_PATHS in app/data/servers.ts).
  rest('server_moves?select=server_id,game,chronicle,id&order=moved_at'),
  // Games, versions, rate words and languages a moderator added (the catalog
  // migration), for the lists in app/data/games.ts and app/i18n/locales.ts.
  rest('catalog?select=kind,game,key,name,badge&order=created_at')
])
const votesById = new Map(votes.map((v) => [v.server_id, v.votes]))

// The shape of Server in app/data/servers.ts.
const servers = rows.map((r) => ({
  id: r.id,
  name: r.name,
  game: r.game,
  chronicle: r.chronicle,
  ...(r.rate == null ? {} : { rate: Number(r.rate) }),
  ...(r.rate_text ? { rateText: r.rate_text } : {}),
  url: r.url,
  openDate: r.open_date,
  listedAt: (r.listed_at ?? r.open_date).slice(0, 10),
  votes: votesById.get(r.id) ?? 0,
  ...(r.description?.trim() ? { description: r.description.trim() } : {}),
  ...(r.language ? { language: r.language } : {}),
  ...(r.language_text ? { languageText: r.language_text } : {}),
  ...(r.links?.length ? { links: r.links.map((l) => ({ kind: l.kind, url: l.url })) } : {})
}))
const json = `${JSON.stringify(servers, null, 2)}\n`
const movesJson = `${JSON.stringify(moves, null, 2)}\n`
const catalogJson = `${JSON.stringify(catalog, null, 2)}\n`

if (process.argv.includes('--check')) {
  const live = await fetch(`${SITE}/live-servers.json`, { cache: 'no-store' })
  const liveMoves = await fetch(`${SITE}/live-moves.json`, { cache: 'no-store' })
  const liveCatalog = await fetch(`${SITE}/live-catalog.json`, { cache: 'no-store' })
  const changed = !live.ok || (await live.text()) !== json || !liveMoves.ok || (await liveMoves.text()) !== movesJson
    || !liveCatalog.ok || (await liveCatalog.text()) !== catalogJson
  console.log(changed ? 'The listed servers changed since the last deploy.' : 'Nothing new.')
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`)
} else {
  await writeFile(new URL('../app/data/live-servers.json', import.meta.url), json)
  // Published beside the site, so the next --check has something to compare.
  await writeFile(new URL('../public/live-servers.json', import.meta.url), json)
  await writeFile(new URL('../app/data/live-moves.json', import.meta.url), movesJson)
  await writeFile(new URL('../public/live-moves.json', import.meta.url), movesJson)
  await writeFile(new URL('../app/data/live-catalog.json', import.meta.url), catalogJson)
  await writeFile(new URL('../public/live-catalog.json', import.meta.url), catalogJson)
  console.log(`${servers.length} listed server(s) from the database.`)
}
