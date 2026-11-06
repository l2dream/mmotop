// The reward notification itself, shared by the vote function (a real vote)
// and postback-test (the owner's test): a POST of JSON to the owner's
// address, signed with their secret key, and a line in postback_log.
//
//   X-MMOTOP-Signature: hex(HMAC-SHA256(secret, "server_id:nickname:vote_id:voted_at"))
//   {"server_id": "...", "nickname": "...", "vote_id": 123, "voted_at": "..."}
//
// A test one says "test": true (outside the signed text) and has vote_id 0.
// A vote's that the server did not take is sent again later, the same
// (see the postback_retries migration and the postback-retry function).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Sends it; the server's HTTP status, or 0 if it did not answer within five seconds. */
export async function sendPostback(
  admin: SupabaseClient,
  pb: { url: string, secret: string },
  vote: { server_id: string, nickname: string, vote_id: number, voted_at: string, test?: boolean, attempt?: number }
): Promise<number> {
  const { test, attempt = 1, ...signed } = vote
  const signature = await hmacHex(pb.secret, `${signed.server_id}:${signed.nickname}:${signed.vote_id}:${signed.voted_at}`)
  let status = 0
  try {
    const res = await fetch(pb.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MMOTOP-Signature': signature },
      body: JSON.stringify(test ? { ...signed, test: true } : signed),
      signal: AbortSignal.timeout(5000)
    })
    status = res.status
    await res.body?.cancel()
  } catch {
    status = 0
  }
  await admin.from('postback_log').insert({ server_id: signed.server_id, nickname: signed.nickname, test: !!test, status, attempt })
  // A month of history is plenty.
  await admin.from('postback_log').delete().lt('sent_at', new Date(Date.now() - 30 * 86400_000).toISOString())
  return status
}

/** Whether a try is worth repeating: no answer, a server error, "too many requests". */
export const shouldRetry = (status: number) => status === 0 || status === 429 || status >= 500

/** Minutes until the next try, after the given number of tries; null when it is time to give up. */
export function retryDelay(attempts: number): number | null {
  return [1, 5, 15, 40][attempts - 1] ?? null
}
