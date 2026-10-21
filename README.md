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

- `app/components/Dashboard.vue` — every page: panels, search, filters, URL sync
- `app/pages/` — routes: home, `/<section>/`, `/<game>/`, `/<game>/<server>/`,
  `/<game>/<chronicle or rate>/` (e.g. `/lineage2/interlude/`, `/lineage2/x50/`)
- `app/data/` — games, servers (test data for now) and the chronicle/rate pages
- `app/i18n/`, `i18n/messages/` — the language registry and translations
- `modules/fonts.ts` — self-hosted fonts, built from Fontsource packages
- `modules/sitemap.ts` — sitemap.xml and robots.txt for every language
