<script setup lang="ts">
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The phone's side of signing in with a QR code: the code it scanned opens
 * the account page with ?approve=<id>.<secret>. Signed in here, the owner
 * sees the four digits the other screen shows and approves; the other screen
 * then signs in by itself (AccountSignIn, the qr-login function).
 */
const props = defineProps<{ supabase: SupabaseClient, request: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const [id, secret] = props.request.split('.')
const code = ref('')
const state = ref<'loading' | 'ask' | 'done' | 'expired'>('loading')
const busy = ref(false)
const error = ref('')

async function call(action: 'peek' | 'approve') {
  const { data } = await props.supabase.auth.getSession()
  const res = await fetch(`${FUNCTIONS_URL}/qr-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ action, id, secret })
  })
  return res.json().catch(() => ({ error: 'failed' }))
}

onMounted(async () => {
  const answer = await call('peek').catch(() => ({ error: 'failed' }))
  if (answer.code) {
    code.value = answer.code
    state.value = 'ask'
  } else {
    state.value = 'expired'
  }
})

async function approve() {
  busy.value = true
  error.value = ''
  const answer = await call('approve').catch(() => ({ error: 'failed' }))
  busy.value = false
  if (answer.ok) state.value = 'done'
  else if (answer.error === 'expired') state.value = 'expired'
  else error.value = t('account.failed')
}
</script>

<template>
  <section class="account-approve" :aria-label="$t('account.signin.approveTitle')">
    <h3 class="account-heading">{{ $t('account.signin.approveTitle') }}</h3>
    <p v-if="state === 'loading'" class="account-note" role="status">{{ $t('account.loading') }}</p>
    <template v-else-if="state === 'ask'">
      <p class="account-lead">{{ $t('account.signin.approveText', { code: '' }) }}<b class="account-qr-digits" dir="ltr">{{ code }}</b></p>
      <div class="account-actions-row">
        <button type="button" class="account-button" :disabled="busy" @click="approve">{{ $t('account.signin.approve') }}</button>
        <button type="button" class="account-link" @click="emit('close')">{{ $t('account.cancel') }}</button>
      </div>
    </template>
    <template v-else>
      <p class="account-lead" role="status">{{ state === 'done' ? $t('account.signin.approveDone') : $t('account.signin.approveExpired') }}</p>
      <button type="button" class="account-link" @click="emit('close')">OK</button>
    </template>
    <p v-if="error" class="account-error" role="alert">{{ error }}</p>
  </section>
</template>
