/** Discord, and the networks a server can list besides it. */
export type SocialKind = 'discord' | 'telegram' | 'vk' | 'youtube' | 'twitch' | 'tiktok' | 'facebook' | 'instagram' | 'x' | 'forum' | 'other'

/**
 * The networks a server can link to besides Discord, in the order the
 * account form offers them. The brands keep their own names in every
 * language; a forum and "other" are named by the page's messages. The
 * database checks the same list (server_links_ok).
 */
export const NETWORKS: { kind: Exclude<SocialKind, 'discord'>, name?: string, placeholder: string }[] = [
  { kind: 'telegram', name: 'Telegram', placeholder: 'https://t.me/…' },
  { kind: 'vk', name: 'VK', placeholder: 'https://vk.com/…' },
  { kind: 'youtube', name: 'YouTube', placeholder: 'https://youtube.com/@…' },
  { kind: 'twitch', name: 'Twitch', placeholder: 'https://twitch.tv/…' },
  { kind: 'tiktok', name: 'TikTok', placeholder: 'https://tiktok.com/@…' },
  { kind: 'facebook', name: 'Facebook', placeholder: 'https://facebook.com/…' },
  { kind: 'instagram', name: 'Instagram', placeholder: 'https://instagram.com/…' },
  { kind: 'x', name: 'X', placeholder: 'https://x.com/…' },
  { kind: 'forum', placeholder: 'https://…' },
  { kind: 'other', placeholder: 'https://…' }
]

/** At most this many, as the database allows. */
export const MAX_LINKS = 8

export interface ServerLink { kind: Exclude<SocialKind, 'discord'>, url: string }
