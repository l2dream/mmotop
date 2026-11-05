<script setup lang="ts">
import type { Server } from '~/data/servers'

/**
 * Voting for a server, opened under its card: an optional in-game nickname
 * (for the reward, when the server gives one), the captcha, and the button.
 * The `vote` function does the rest — one vote per IP per server every 12
 * hours, the reward postback — and its answer is shown here.
 *
 * The count on the page is the one the site was built with; a vote shows in
 * it after the next rebuild (within half an hour), so a vote just cast is
 * added here by hand meanwhile.
 */
const props = defineProps<{ server: Server }>()
const emit = defineEmits<{ voted: [] }>()

const { t, locale } = useI18n()

/** The same rule the function checks. */
const NICK = /^[\p{L}\p{N}_\-. ]{2,32}$/u

const nickname = ref('')
const token = ref<string | null>(null)
const busy = ref(false)
const done = ref(false)
const message = ref('')
const failed = ref(false)

const captchaEl = ref<HTMLElement | null>(null)
let captcha: { reset: () => void, remove: () => void } | null = null

onMounted(async () => {
  try {
    captcha = await mountTurnstile(captchaEl.value!, (value) => { token.value = value })
  } catch {
    failed.value = true
    message.value = t('vote.captchaLoad')
  }
})
onUnmounted(() => captcha?.remove())

/** "в 14:30" today, a full date and time otherwise, in the page's language. */
function when(iso: string) {
  const at = new Date(iso)
  const sameDay = at.toDateString() === new Date().toDateString()
  return new Intl.DateTimeFormat(locale.value, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(at)
}

async function vote() {
  const nick = nickname.value.trim()
  if (nick && !NICK.test(nick)) {
    failed.value = true
    message.value = t('vote.badNickname')
    return
  }
  if (!token.value || busy.value) return
  busy.value = true
  message.value = ''
  failed.value = false
  let answer: { ok?: boolean, error?: string, next_vote_at?: string, rewarded?: boolean } = {}
  try {
    const res = await fetch(`${FUNCTIONS_URL}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server_id: props.server.id, nickname: nick || undefined, captcha: token.value })
    })
    answer = await res.json().catch(() => ({}))
  } catch {
    answer = { error: 'network' }
  }
  busy.value = false
  if (answer.ok) {
    done.value = true
    message.value = answer.rewarded ? t('vote.thanksRewarded') : t('vote.thanks')
    emit('voted')
    return
  }
  failed.value = true
  message.value = answer.error === 'too_soon' && answer.next_vote_at
    ? t('vote.tooSoon', { time: when(answer.next_vote_at) })
    : answer.error === 'bad_nickname'
      ? t('vote.badNickname')
      : answer.error === 'captcha'
        ? t('vote.captchaFailed')
        : t('vote.failed')
  // A captcha answer counts once, whatever the vote's outcome.
  captcha?.reset()
}
</script>

<template>
  <form class="vote-box" @submit.prevent="vote">
    <template v-if="!done">
      <!-- Only where a vote brings a reward: elsewhere the nickname goes nowhere. -->
      <label v-if="server.reward" class="account-field">
        <span>{{ $t('vote.nickname') }}</span>
        <input v-model="nickname" type="text" maxlength="32" autocomplete="off" autocapitalize="off" spellcheck="false">
        <small>{{ $t('vote.nicknameHint') }}</small>
      </label>
      <div ref="captchaEl" class="vote-captcha" />
      <button type="submit" class="account-button" :disabled="!token || busy">{{ $t('vote.submit') }}</button>
    </template>
    <p v-if="message" class="vote-message" :class="{ 'vote-error': failed, 'vote-ok': done }" role="status">{{ message }}</p>
  </form>
</template>
