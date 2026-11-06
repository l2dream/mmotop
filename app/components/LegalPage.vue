<script setup lang="ts">
/**
 * /privacy/ and /terms/: what the site keeps about people and the rules for
 * listing a server. Google asks for both before "Sign in with Google" may be
 * offered to everyone. Written in Russian for the Russian pages and in
 * English for every other language (marked lang="en" there), rather than
 * machine-translated into twenty-six legal texts.
 *
 * CONTACT is the address people may write to about their data; empty until
 * the owner gives one, and then the paragraph shows.
 */
const props = defineProps<{ kind: 'privacy' | 'terms' }>()
const { locale } = useI18n()
const CONTACT = ''
const ru = computed(() => locale.value === 'ru')

type Doc = { title: string, updated: string, sections: { h: string, p: string[] }[] }
const UPDATED = '2026-11-06'

const PRIVACY_RU: Doc = {
  title: 'Политика конфиденциальности',
  updated: `Обновлено ${UPDATED}`,
  sections: [
    { h: 'Кто мы', p: ['MMOTOP (mmotop.com) — каталог и рейтинг игровых серверов. Эта страница объясняет, какие данные сайт хранит, зачем и как их удалить.'] },
    { h: 'Что мы храним', p: [
      'Аккаунт владельца сервера: адрес почты; при входе через Telegram, Google или Discord — идентификатор и имя в этом сервисе и почту, если сервис её передаёт; язык сайта, на котором приходят сообщения.',
      'Серверы, которые добавил владелец: всё, что он указал в форме (название, адрес сайта, соцсети, описание, картинки, логотип), и настройки награды за голос.',
      'Голоса: за какой сервер и когда, ник в игре, если его указали, и зашифрованный отпечаток IP-адреса (сам адрес не сохраняется) — только чтобы с одного адреса голосовали не чаще раза в 12 часов.',
      'Журнал уведомлений о награде за голос — 30 дней.'
    ] },
    { h: 'Зачем', p: ['Чтобы вы могли войти и управлять своими серверами, чтобы считать голоса честно, сообщать владельцу о решении модератора и передавать голос серверу для награды. Мы не продаём данные, не показываем рекламу и не передаём данные третьим лицам, кроме сервисов, без которых сайт не работает (ниже).'] },
    { h: 'Сервисы, которыми мы пользуемся', p: ['Supabase — база данных и вход; Cloudflare Turnstile — защита голосования от ботов; Resend — письма; Telegram — вход и сообщения через бота; Google и Discord — вход, если вы его выбрали; GitHub Pages — размещение сайта. Ник игрока и номер голоса уходят на сервер, за который он проголосовал, если владелец включил награду.'] },
    { h: 'Что хранится в браузере', p: ['Вход в кабинет (если вы не отметили «Чужой компьютер»), выбранная тема и язык. Рекламных и следящих cookie нет.'] },
    { h: 'Как удалить данные', p: ['В кабинете: «Аккаунт» → «Удалить аккаунт». Удаляются аккаунт, все ваши серверы, голоса за них и загруженные картинки, сразу и без возможности восстановления.'] }
  ]
}
const PRIVACY_EN: Doc = {
  title: 'Privacy Policy',
  updated: `Updated ${UPDATED}`,
  sections: [
    { h: 'Who we are', p: ['MMOTOP (mmotop.com) is a directory and ranking of game servers. This page explains what the site keeps, why, and how to delete it.'] },
    { h: 'What we keep', p: [
      'A server owner’s account: the email address; when signing in with Telegram, Google or Discord, the id and name there and the email if the service gives it; the site language messages are sent in.',
      'The servers an owner adds: what they entered in the form (name, website, social links, description, pictures, logo) and the vote reward settings.',
      'Votes: which server and when, the in-game nickname if one was given, and a hashed fingerprint of the IP address (the address itself is not stored) — only so that one address votes at most once every 12 hours.',
      'The vote reward notification log, for 30 days.'
    ] },
    { h: 'Why', p: ['So you can sign in and manage your servers, so votes are counted fairly, so owners hear the moderator’s decision, and so a vote reaches the game server for its reward. We do not sell data, show ads or pass data to anyone except the services the site cannot run without (below).'] },
    { h: 'Services we use', p: ['Supabase — database and sign-in; Cloudflare Turnstile — keeping bots out of voting; Resend — email; Telegram — sign-in and messages through the bot; Google and Discord — sign-in, if you choose them; GitHub Pages — hosting. A player’s nickname and vote number go to the server they voted for if its owner switched the reward on.'] },
    { h: 'What your browser keeps', p: ['Your sign-in (unless you ticked “Someone else’s computer”), the theme and the language. No advertising or tracking cookies.'] },
    { h: 'Deleting your data', p: ['In your account: “Account” → “Delete account”. The account, all your servers, their votes and your uploaded pictures are deleted at once, for good.'] }
  ]
}
const TERMS_RU: Doc = {
  title: 'Условия использования',
  updated: `Обновлено ${UPDATED}`,
  sections: [
    { h: 'Сайт', p: ['MMOTOP бесплатно показывает игровые серверы и рейтинг по голосам игроков. Пользуясь сайтом, вы соглашаетесь с этими условиями.'] },
    { h: 'Владельцам серверов', p: [
      'Указывайте правдивые сведения о сервере и только свой сервер. Каждый новый сервер и изменение проверяет модератор; он может отклонить или скрыть сервер и указать причину.',
      'Нельзя накручивать голоса: ботами, обходом ограничений, покупкой голосов или выдачей награды за голоса с чужих аккаунтов. Сервер, который накручивает, скрывается.',
      'Описание, картинки и логотип не должны нарушать закон и чужие права.'
    ] },
    { h: 'Игрокам', p: ['Голосовать можно раз в 12 часов за сервер. Награду за голос выдаёт сам игровой сервер; MMOTOP только передаёт ему ваш голос и не отвечает за награду.'] },
    { h: 'Ответственность', p: ['Серверы принадлежат их владельцам, MMOTOP за них не отвечает. Сайт работает «как есть», мы можем менять его и эти условия.'] }
  ]
}
const TERMS_EN: Doc = {
  title: 'Terms of Use',
  updated: `Updated ${UPDATED}`,
  sections: [
    { h: 'The site', p: ['MMOTOP lists game servers and ranks them by players’ votes, free of charge. By using the site you agree to these terms.'] },
    { h: 'Server owners', p: [
      'Give true information, and list only your own server. A moderator checks every new server and every change, and may reject or hide a server, saying why.',
      'Do not inflate votes — with bots, by getting round the limits, by buying votes, or by rewarding votes from other people’s accounts. A server that does is hidden.',
      'Descriptions, pictures and logos must not break the law or anyone’s rights.'
    ] },
    { h: 'Players', p: ['You can vote for a server once every 12 hours. The vote reward is given by the game server itself; MMOTOP only passes your vote on and is not responsible for the reward.'] },
    { h: 'Responsibility', p: ['Servers belong to their owners, and MMOTOP is not responsible for them. The site is provided as is; we may change it and these terms.'] }
  ]
}

const doc = computed(() => (props.kind === 'privacy' ? (ru.value ? PRIVACY_RU : PRIVACY_EN) : (ru.value ? TERMS_RU : TERMS_EN)))
defineExpose({ title: computed(() => doc.value.title) })
</script>

<template>
  <GamePanel class="section-panel accent-violet legal-panel" :title="doc.title">
    <article class="legal-body" :lang="ru ? 'ru' : 'en'" :dir="ru ? undefined : 'ltr'">
      <p class="account-note">{{ doc.updated }}</p>
      <section v-for="s in doc.sections" :key="s.h">
        <h2>{{ s.h }}</h2>
        <p v-for="(text, i) in s.p" :key="i">{{ text }}</p>
      </section>
      <section v-if="CONTACT">
        <h2>{{ ru ? 'Связаться с нами' : 'Contact' }}</h2>
        <p><a :href="`mailto:${CONTACT}`">{{ CONTACT }}</a></p>
      </section>
    </article>
  </GamePanel>
</template>
