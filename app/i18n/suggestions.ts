/**
 * The suggestion banner's own words, one set per language.
 *
 * These live apart from the message files on purpose. A banner offering Korean
 * has to be written in Korean while the page around it is still English — and
 * the message files load one locale at a time, so the Korean strings are not
 * there to reach for. Three short lines per language is small enough to ship
 * with every page and never think about again.
 *
 * `prompt` names its own language inside the sentence rather than taking it as
 * a placeholder, because "available in {language}" does not survive contact
 * with grammatical case. Lithuanian wants "lietuvių kalba", Estonian wants
 * "eesti keeles", and neither is the name in the selector.
 */
export interface Suggestion {
  prompt: string
  action: string
  dismiss: string
}

export const SUGGESTIONS: Record<string, Suggestion> = {
  en:      { prompt: 'This page is also available in English.',                    action: 'Switch to English',            dismiss: 'Dismiss' },
  'en-us': { prompt: 'This page is also available in English (US).',               action: 'Switch to English (US)',       dismiss: 'Dismiss' },
  ru:      { prompt: 'Эта страница доступна и на русском языке.',                  action: 'Перейти на русский',           dismiss: 'Закрыть' },
  uk:      { prompt: 'Ця сторінка доступна також українською.',                    action: 'Перейти на українську',        dismiss: 'Закрити' },
  az:      { prompt: 'Bu səhifə Azərbaycan dilində də mövcuddur.',                 action: 'Azərbaycan dilinə keç',        dismiss: 'Bağla' },
  cs:      { prompt: 'Tato stránka je dostupná také v češtině.',                   action: 'Přepnout na češtinu',          dismiss: 'Zavřít' },
  da:      { prompt: 'Denne side er også tilgængelig på dansk.',                   action: 'Skift til dansk',              dismiss: 'Luk' },
  de:      { prompt: 'Diese Seite ist auch auf Deutsch verfügbar.',                action: 'Auf Deutsch wechseln',         dismiss: 'Schließen' },
  et:      { prompt: 'See leht on saadaval ka eesti keeles.',                      action: 'Lülitu eesti keelele',         dismiss: 'Sulge' },
  es:      { prompt: 'Esta página también está disponible en español.',            action: 'Cambiar a español',            dismiss: 'Cerrar' },
  fr:      { prompt: 'Cette page est aussi disponible en français.',               action: 'Passer au français',           dismiss: 'Fermer' },
  lv:      { prompt: 'Šī lapa ir pieejama arī latviešu valodā.',                   action: 'Pārslēgt uz latviešu valodu',  dismiss: 'Aizvērt' },
  lt:      { prompt: 'Šis puslapis taip pat pasiekiamas lietuvių kalba.',          action: 'Perjungti į lietuvių kalbą',   dismiss: 'Uždaryti' },
  no:      { prompt: 'Denne siden er også tilgjengelig på norsk.',                 action: 'Bytt til norsk',               dismiss: 'Lukk' },
  pl:      { prompt: 'Ta strona jest dostępna także po polsku.',                   action: 'Przełącz na polski',           dismiss: 'Zamknij' },
  pt:      { prompt: 'Esta página também está disponível em português.',           action: 'Mudar para português',         dismiss: 'Fechar' },
  'pt-br': { prompt: 'Esta página também está disponível em português (Brasil).',  action: 'Mudar para português (Brasil)', dismiss: 'Fechar' },
  sv:      { prompt: 'Den här sidan finns även på svenska.',                       action: 'Byt till svenska',             dismiss: 'Stäng' },
  tr:      { prompt: 'Bu sayfa Türkçe olarak da mevcut.',                          action: 'Türkçeye geç',                 dismiss: 'Kapat' },
  el:      { prompt: 'Αυτή η σελίδα είναι διαθέσιμη και στα ελληνικά.',            action: 'Αλλαγή στα ελληνικά',          dismiss: 'Κλείσιμο' },
  hy:      { prompt: 'Այս էջը հասանելի է նաև հայերենով։',                          action: 'Անցնել հայերենի',              dismiss: 'Փակել' },
  ar:      { prompt: 'هذه الصفحة متوفرة أيضًا بالعربية.',                            action: 'التبديل إلى العربية',             dismiss: 'إغلاق' },
  he:      { prompt: 'הדף הזה זמין גם בעברית.',                                     action: 'עבור לעברית',                  dismiss: 'סגור' },
  zh:      { prompt: '本页面也提供简体中文版本。',                                        action: '切换到简体中文',                  dismiss: '关闭' },
  ja:      { prompt: 'このページは日本語でもご覧いただけます。',                              action: '日本語に切り替える',                dismiss: '閉じる' },
  ko:      { prompt: '이 페이지는 한국어로도 볼 수 있습니다.',                              action: '한국어로 전환',                  dismiss: '닫기' }
}

/** Where a script's full font lives. Shared by the page head and the banner,
 *  which needs the same face to write a sentence nobody has loaded yet. */
export function fontUrl(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;500;600;700;800&display=swap`
}

/**
 * Exactly the characters each script contributes to the selector, so the
 * subset request carries nothing else. Six families in full would be
 * megabytes, most of it CJK, to draw eleven glyphs.
 */
const PICKER_GLYPHS: Record<string, string> = {
  'Noto Sans Armenian': 'ՀԱՅԵՐԵՆ',
  'Noto Sans Arabic': 'العربية',
  'Noto Sans Hebrew': 'עברית',
  'Noto Sans SC': '简体中文',
  'Noto Sans JP': '日本語',
  'Noto Sans KR': '한국어'
}

/**
 * The subset requests for the selector, minus whichever family this page
 * already loads in full.
 *
 * That exclusion is the point. Both requests declare @font-face for the same
 * family name, and the `text=` response carries no unicode-range to keep them
 * apart — so on /ko the three-glyph subset, declared later in the cascade,
 * would win for weights 400 and 700 and the body text would fall through to a
 * system font at exactly those weights while 500, 600 and 800 rendered in real
 * Noto. A page cannot collide with itself if it never asks for both.
 */
export function pickerFontUrls(exclude?: string | null): string[] {
  return Object.entries(PICKER_GLYPHS)
    .filter(([family]) => family !== exclude)
    .map(([family, glyphs]) => {
      const chars = [...new Set(glyphs)].sort().join('')
      return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}`
        + `:wght@400;700&text=${encodeURIComponent(chars)}&display=swap`
    })
}
