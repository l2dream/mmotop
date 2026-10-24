# Backend (Supabase)

Accounts, servers and votes live in a Supabase project; the site itself stays
static on GitHub Pages and talks to it from the browser.

- `migrations/` — the database: profiles, servers (with moderation), postback
  settings, votes, and the monthly vote counts. Row Level Security decides who
  reads and writes what; see the comments at the top of the migration.
- `functions/vote` — casting a vote: Cloudflare Turnstile captcha, one vote per
  IP per server every 12 hours, and the reward postback.
- `functions/telegram-auth` — sign-in with Telegram, which Supabase lacks.

## Secrets

Set with `supabase secrets set NAME=value` (never committed):

| Name | Used by | What |
| --- | --- | --- |
| `TURNSTILE_SECRET` | vote | Cloudflare Turnstile secret key |
| `VOTE_SALT` | vote | any long random string; salts the stored IP hashes |
| `TELEGRAM_BOT_TOKEN` | telegram-auth | the bot's token from @BotFather |

## Vote reward (postback) — for server owners

When a player votes and enters their in-game nickname, and the owner has
switched the reward on, MMOTOP sends:

```
POST <your postback URL>          (https only)
Content-Type: application/json
X-MMOTOP-Signature: <hex HMAC-SHA256>

{ "server_id": "la2dream", "nickname": "Player1", "vote_id": 123, "voted_at": "2026-10-24T12:00:00.000Z" }
```

The signature is HMAC-SHA256, keyed with your postback secret (shown in your
cabinet), over `server_id:nickname:vote_id:voted_at`. Check it before granting
anything, and grant once per `vote_id`. Answer with any 2xx status; the call
times out after 5 seconds.
