# Yala Maha — landing page

The public landing page for the Yala Maha farmer app (Next.js 16, Tailwind CSS 4).

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Before deploying

Set the farmer app's public address. It is used for every "Open the app" button and for the QR code. Also set the public landing-page origin to the production domain in Vercel so canonical links and the sitemap use the right host:

```bash
NEXT_PUBLIC_APP_URL=https://your-farmer-app-address NEXT_PUBLIC_SITE_URL=https://your-landing-page-domain npm run build
```

Without it the page links to `http://localhost:5174` (the farmer portal's dev server).
`NEXT_PUBLIC_SITE_URL` may be a full URL or a hostname. If it is unset, the site URL helper uses Vercel's production hostname when available, then the deployment hostname, and finally `http://localhost:3000` for local development.

## Search and AI crawlers

- `/robots.txt` allows standard and selected AI crawlers and points to the sitemap.
- `/sitemap.xml` lists the landing page and photo credits.
- The landing page includes canonical, Open Graph, Twitter, and SoftwareApplication structured metadata.
- The home page is prerendered by Next.js, so its headings, copy, and structured data are present in the initial HTML without client-side rendering.

### Vercel deployment checks

- Set `NEXT_PUBLIC_SITE_URL` to the production custom domain in the Vercel project. Preview deployments may otherwise publish preview-host canonical and sitemap URLs.
- In **Project → Settings → Firewall**, ensure the AI Bots Managed Ruleset and Bot Protection settings do not deny or challenge the crawlers you want to reach the site. `robots.txt` is only a crawler directive; it cannot bypass a firewall challenge.
- The current `robots.txt` allows `OAI-SearchBot`, `PerplexityBot`, and `Claude-SearchBot`, as well as `GPTBot` and `ClaudeBot` (the latter are commonly used for model training).

## Where things are

- `lib/site.ts` — app name, app link and the coverage numbers shown on the page (117 reservoirs, 40 river gauges, 19 rivers, 55 canal sections, 14-day forecast, 3 languages). Update them here if the data grows.
- `app/(en)/page.tsx` — the page, section by section; `app/(en)/credits/page.tsx` — photo credits.
- `app/robots.ts` and `app/sitemap.ts` — crawler discovery endpoints.
- `components/landing/` — the sections.
- `public/images/screens/` — screenshots of the farmer app in a phone frame.
- `public/images/photos/` — Wikimedia Commons photos; `CREDITS.md` lists authors and licences. CC BY-SA photos must keep their attribution (shown on `/credits`).
- `public/assets/` — the layout template's stylesheet, fonts and decorative clouds.

The layout comes from the "Habitline" template (Envato Elements, unifato); all of its text, photos and screens have been replaced.
