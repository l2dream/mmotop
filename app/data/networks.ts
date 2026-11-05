import CATALOG from './live-catalog.json'

/**
 * The networks a server can list: the built-in ones below, and those a
 * moderator added (the catalog table, kind 'network') by their key.
 */
export type SocialKind = string

/**
 * The networks a server can link to, in the order the account form offers
 * them: by how often game servers use them, the most common first (as the
 * owner asked, 5 November 2026), then a forum and "other". The brands keep their own names in every
 * language; a forum and "other" are named by the page's messages. The
 * database checks the same list (server_links_ok).
 */
const BUILT_IN: { kind: SocialKind, name?: string, placeholder: string }[] = [
  { kind: 'discord', name: 'Discord', placeholder: 'https://discord.gg/…' },
  { kind: 'telegram', name: 'Telegram', placeholder: 'https://t.me/…' },
  { kind: 'youtube', name: 'YouTube', placeholder: 'https://youtube.com/@…' },
  { kind: 'vk', name: 'VK', placeholder: 'https://vk.com/…' },
  { kind: 'tiktok', name: 'TikTok', placeholder: 'https://tiktok.com/@…' },
  { kind: 'twitch', name: 'Twitch', placeholder: 'https://twitch.tv/…' },
  { kind: 'facebook', name: 'Facebook', placeholder: 'https://facebook.com/…' },
  { kind: 'instagram', name: 'Instagram', placeholder: 'https://instagram.com/…' },
  { kind: 'x', name: 'X', placeholder: 'https://x.com/…' },
  { kind: 'ok', name: 'Odnoklassniki', placeholder: 'https://ok.ru/…' },
  { kind: 'forum', placeholder: 'https://…' },
  { kind: 'other', placeholder: 'https://…' }
]

/** …with the moderator's additions before the forum and "other". */
export const NETWORKS = [
  ...BUILT_IN.slice(0, -2),
  ...(CATALOG as { kind: string, key: string, name: string }[])
    .filter((e) => e.kind === 'network' && !BUILT_IN.some((n) => n.kind === e.key))
    .map((e) => ({ kind: e.key, name: e.name, placeholder: 'https://…' })),
  ...BUILT_IN.slice(-2)
]

/** At most this many, as the database allows. */
export const MAX_LINKS = 8

/**
 * One of the server's links. `name` is set on an "Other network…" one: the
 * network the owner named, not yet in the list (a moderator adds it).
 */
export interface ServerLink { kind: SocialKind, url: string, name?: string }

/** A link's label on its button: the owner's name for it, the network's, or the page's word for a forum or anything else. */
export function networkName(link: Pick<ServerLink, 'kind' | 'name'>) {
  return link.name || NETWORKS.find((n) => n.kind === link.kind)?.name
}
