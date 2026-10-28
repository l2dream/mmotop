// Tells search engines which pages changed, through IndexNow
// (https://www.indexnow.org): one request to api.indexnow.org reaches Bing,
// Yandex, Seznam, Naver and the others that take part, instead of waiting
// for each of them to come back to the sitemap on its own.
//
// Run by .github/workflows/indexnow.yml once a day. Every deploy rebuilds
// every page, so "what changed" is every address in the live sitemap — and
// sending all of them after each of the day's many deploys would look like
// spam. Once a day, and only when the sitemap was rebuilt today or yesterday
// (its <lastmod> is the build date, by the UTC calendar), is the measure:
//
//   node scripts/indexnow.mjs           only if the site was deployed lately
//   node scripts/indexnow.mjs --force   regardless
//
// The key is not a secret. It proves the site asked for the URLs to be
// crawled, by being served at /<key>.txt (public/), and the protocol has
// every engine fetch it from there.

const SITE = 'https://mmotop.com'
const KEY = 'd89799d8c543a36515c4f0cf92debed2'
const DAY_MS = 24 * 60 * 60 * 1000

const force = process.argv.includes('--force')

const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text()
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
const lastmod = sitemap.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]
if (!urls.length) throw new Error('The sitemap lists no addresses.')

// Whole days between the build date and today. The run is early in the UTC
// morning, so yesterday's deploys are the ones it is there for.
const today = Date.parse(new Date().toISOString().slice(0, 10))
const days = lastmod ? (today - Date.parse(lastmod.slice(0, 10))) / DAY_MS : Infinity
if (!force && days > 1) {
  console.log(`No deploy since ${lastmod}; nothing to send.`)
  process.exit(0)
}

// The engines check the key file before they accept anything.
const keyFile = await fetch(`${SITE}/${KEY}.txt`)
if (!keyFile.ok || (await keyFile.text()).trim() !== KEY) {
  throw new Error(`${SITE}/${KEY}.txt does not serve the key (HTTP ${keyFile.status}).`)
}

// Up to 10,000 addresses a request.
for (let i = 0; i < urls.length; i += 10000) {
  const urlList = urls.slice(i, i + 10000)
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList })
  })
  console.log(`Sent ${urlList.length} addresses (sitemap of ${lastmod}): HTTP ${res.status}`)
  // 200 and 202 both mean received.
  if (!res.ok) throw new Error(await res.text())
}
