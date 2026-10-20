# MMOTOP

A directory of game servers (Lineage II, World of Warcraft and others), built
with Nuxt 4 and Vue 3, in 26 languages. Live at https://mmotop.com/.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # must pass: the deploy runs it first
```

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`: type-check, then
`npm run generate`, then publish to GitHub Pages. The base path and the
site's address come from the Pages settings (custom domain mmotop.com, set
in Settings → Pages). The site is fully static.

## Where things are

- `app/pages/index.vue` — the dashboard: panels, search, filters, URL sync
- `app/data/` — games and servers (servers are test data for now)
- `app/i18n/`, `i18n/messages/` — the language registry and translations
- `modules/fonts.ts` — self-hosted fonts, built from Fontsource packages
- `modules/sitemap.ts` — sitemap.xml for every language
