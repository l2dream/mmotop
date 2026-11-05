<script setup lang="ts">
/**
 * Telegram's own login button (https://core.telegram.org/widgets/login),
 * for the bot in TELEGRAM_BOT. Pressed, Telegram asks the visitor to confirm
 * in the app on their phone, then hands the page their signed details, which
 * go to the telegram-auth function: to sign in, or — `link` — to tie this
 * Telegram to the account already signed in.
 */
const props = defineProps<{ link?: boolean }>()
const emit = defineEmits<{ done: [answer: { token_hash?: string, linked?: boolean, error?: string }] }>()
const { locale } = useI18n()
const box = ref<HTMLElement | null>(null)
const name = `mmotopTelegram${Math.random().toString(36).slice(2, 8)}`

onMounted(() => {
  if (!TELEGRAM_BOT || !box.value) return
  ;(window as unknown as Record<string, unknown>)[name] = async (user: Record<string, unknown>) => {
    let answer: { token_hash?: string, linked?: boolean, error?: string } = {}
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (props.link) {
        const { data } = await (await useSupabase()).auth.getSession()
        if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
      }
      const res = await fetch(`${FUNCTIONS_URL}/telegram-auth`, {
        method: 'POST',
        headers,
        body: JSON.stringify(props.link ? { ...user, link: '1' } : user)
      })
      answer = await res.json().catch(() => ({ error: 'failed' }))
    } catch {
      answer = { error: 'failed' }
    }
    emit('done', answer)
  }
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.dataset.telegramLogin = TELEGRAM_BOT
  script.dataset.size = 'large'
  script.dataset.radius = '10'
  script.dataset.requestAccess = 'write'
  script.dataset.userpic = 'false'
  script.dataset.lang = locale.value.split('-')[0]
  script.dataset.onauth = `${name}(user)`
  box.value.appendChild(script)
})
onUnmounted(() => {
  delete (window as unknown as Record<string, unknown>)[name]
})
</script>

<template>
  <div ref="box" class="telegram-login" />
</template>
