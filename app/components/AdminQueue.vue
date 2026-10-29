<script setup lang="ts">
import type { SupabaseClient } from '@supabase/supabase-js'
import { gameById } from '~/data/games'

/**
 * Moderation, in the account page of an admin: the servers waiting for a
 * decision, or every server, with approve / reject / hide. The database lets
 * only an admin do this (the "servers: admin moderates" policy); this is just
 * the buttons. Approval stamps the listing date (servers_guard).
 *
 * Russian only for now: the one admin reads Russian, and the strings live
 * here rather than in twenty-six message files.
 */

type Status = 'pending' | 'approved' | 'rejected' | 'hidden'

interface QueueServer {
  id: string
  name: string
  game: string
  chronicle: string
  rate: number | null
  url: string
  open_date: string
  description: string | null
  status: Status
  created_at: string
}

const props = defineProps<{ supabase: SupabaseClient }>()

const STATUS_LABEL: Record<Status, string> = {
  pending: 'На проверке',
  approved: 'Опубликован',
  rejected: 'Отклонён',
  hidden: 'Скрыт'
}

const showAll = ref(false)
const rows = ref<QueueServer[]>([])
const loading = ref(false)
const error = ref('')
const busyId = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  let query = props.supabase
    .from('servers')
    .select('id, name, game, chronicle, rate, url, open_date, description, status, created_at')
    .order('created_at', { ascending: false })
  if (!showAll.value) query = query.eq('status', 'pending')
  const { data, error: failed } = await query
  loading.value = false
  if (failed) error.value = 'Не удалось загрузить список.'
  else rows.value = data as QueueServer[]
}

watch(showAll, load)
onMounted(load)

async function setStatus(row: QueueServer, status: Status) {
  busyId.value = row.id
  error.value = ''
  const { error: failed } = await props.supabase.from('servers').update({ status }).eq('id', row.id)
  busyId.value = null
  if (failed) error.value = `Не удалось изменить ${row.name}.`
  else load()
}

const ACTIONS: { status: Status, label: string }[] = [
  { status: 'approved', label: 'Одобрить' },
  { status: 'rejected', label: 'Отклонить' },
  { status: 'hidden', label: 'Скрыть' }
]
</script>

<template>
  <section class="admin-queue">
    <div class="account-who">
      <h3 class="account-heading">Модерация</h3>
      <button type="button" class="account-link" @click="showAll = !showAll">
        {{ showAll ? 'Только на проверке' : 'Показать все' }}
      </button>
    </div>

    <p v-if="loading && !rows.length" class="account-note" role="status">Загрузка…</p>
    <p v-else-if="!rows.length" class="account-note">{{ showAll ? 'Серверов пока нет.' : 'Ничего не ждёт проверки.' }}</p>
    <ul v-else class="account-servers">
      <li v-for="s in rows" :key="s.id" class="account-server">
        <div class="account-server-main">
          <span class="account-strong">{{ s.name }}</span>
          <span class="account-note">
            {{ gameById(s.game)?.name ?? s.game }} · {{ s.chronicle }}<template v-if="s.rate != null"> · x{{ s.rate }}</template> · {{ s.open_date }}
          </span>
          <a class="account-note admin-url" :href="s.url" target="_blank" rel="noopener nofollow" dir="ltr">{{ s.url }}</a>
          <span class="account-note" dir="ltr">/{{ s.game }}/{{ s.id }}/</span>
        </div>
        <span class="account-status" :class="`status-${s.status}`">{{ STATUS_LABEL[s.status] }}</span>
        <p v-if="s.description" class="admin-description">{{ s.description }}</p>
        <div class="account-server-tools">
          <button
            v-for="a in ACTIONS.filter((a) => a.status !== s.status)"
            :key="a.status"
            type="button"
            class="account-link"
            :class="{ 'account-danger': a.status !== 'approved' }"
            :disabled="busyId === s.id"
            @click="setStatus(s, a.status)"
          >
            {{ a.label }}
          </button>
        </div>
      </li>
    </ul>
    <p v-if="error" class="account-error" role="alert">{{ error }}</p>
  </section>
</template>
