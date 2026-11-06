<script setup lang="ts">
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Who moderates, for an admin: the list, adding someone by the email of
 * their account, taking it away. The database does the deciding
 * (admin_list, admin_set — admins only, never the last admin). Russian only,
 * like the rest of moderation.
 */
const props = defineProps<{ supabase: SupabaseClient, me: string }>()

const rows = ref<{ id: string, email: string, telegram: boolean }[]>([])
const email = ref('')
const busy = ref(false)
const message = ref('')
const failed = ref(false)

async function load() {
  const { data } = await props.supabase.rpc('admin_list')
  rows.value = (data ?? []) as typeof rows.value
}
onMounted(load)

const SAY: Record<string, string> = {
  ok: 'Готово.',
  no_user: 'Нет аккаунта с такой почтой: человек должен сначала один раз войти на сайт.',
  last_admin: 'Нельзя снять последнего администратора.'
}

async function set(address: string, on: boolean) {
  if (!address.trim() || busy.value) return
  if (!on && !window.confirm(`Снять права модератора с ${address}?`)) return
  busy.value = true
  message.value = ''
  const { data, error } = await props.supabase.rpc('admin_set', { p_email: address.trim(), p_on: on })
  busy.value = false
  failed.value = !!error || data !== 'ok'
  message.value = error ? 'Не удалось изменить.' : SAY[data as string] ?? String(data)
  if (!failed.value && on) email.value = ''
  load()
}
</script>

<template>
  <section class="admin-moderators">
    <h3 class="account-heading">Модераторы</h3>
    <p class="account-note">Модераторы видят этот же блок модерации: одобряют и отклоняют серверы, добавляют игры и версии, назначают других модераторов.</p>
    <ul class="account-postback-log">
      <li v-for="r in rows" :key="r.id">
        <bdi class="account-strong">{{ r.email }}</bdi>
        <span v-if="r.id === me" class="account-note">(вы)</span>
        <span v-if="r.telegram" class="account-note">Telegram</span>
        <button v-if="r.id !== me" type="button" class="account-link account-danger admin-moderator-remove" :disabled="busy" @click="set(r.email, false)">Снять</button>
      </li>
    </ul>
    <form class="account-secret-row" @submit.prevent="set(email, true)">
      <input v-model="email" class="admin-moderator-email" type="email" placeholder="Почта аккаунта" autocomplete="off" required>
      <button type="submit" class="account-link" :disabled="busy">Назначить</button>
    </form>
    <p v-if="message" :class="failed ? 'account-error' : 'account-ok'" role="status">{{ message }}</p>
  </section>
</template>
