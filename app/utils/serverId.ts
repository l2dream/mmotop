/**
 * A server's address on the site (/lineage2/<id>/), made from its name so an
 * owner never has to think one up: "LA2DREAM" → "la2dream", "Мечта x50" →
 * "mechta-x50". The result always fits what the database accepts — lowercase
 * Latin letters, digits and hyphens, 3 to 32 characters, not starting like a
 * rate page ("x50").
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'e', є: 'ye', ж: 'zh', з: 'z',
  и: 'i', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ў: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
}

export function serverIdFrom(name: string) {
  let id = name
    .toLowerCase()
    .replace(/[\u0400-\u04ff]/g, (ch) => CYRILLIC[ch] ?? '')
    // Accents off the Latin letters: "Élan" → "elan".
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '')
  if (/^x[0-9]/.test(id)) id = `s-${id}`.slice(0, 32).replace(/-+$/, '')
  if (id.length < 3) id = id ? `${id}-server` : 'server'
  return id
}

/** The same address with a number on the end, for when it is taken: la2dream-2. */
export function serverIdWithNumber(id: string, n: number) {
  const tail = `-${n}`
  return `${id.slice(0, 32 - tail.length).replace(/-+$/, '')}${tail}`
}

/** What the database accepts as an address. */
export const SERVER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/
