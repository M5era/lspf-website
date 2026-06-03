# Lisbon Street Photo Fest — MVP

An Astro + Tailwind static site, ready to be wired to Sanity (CMS) and
Ticket Tailor (ticketing). Designed to deploy on Cloudflare Pages for €0.

## Run it (frontend)

```bash
npm install
npm run dev
```

Open <http://localhost:4321>.

## Run the CMS

The Sanity Studio is already scaffolded in `studio/` with all schemas wired up.

```bash
cd studio
npm install
npm run dev
```

Open <http://localhost:3333>. Sign in with the same account that owns project
`nsxw1yrt`. You'll see the content editor with all content types ready to use:
Site Settings, Festival Edition, Workshop, Finalists (Singles + Series),
Exhibition, and Page.

When ready to publish the editor at a public URL:

```bash
cd studio
npm run deploy
```

That deploys to `lspf.sanity.studio` (configurable in `studio/sanity.cli.ts`).

## Flip the site from placeholders to live Sanity content

The site reads through loader functions (`src/lib/loaders.ts`) that try Sanity
first, then fall back to placeholder data in `src/data/*.ts`. This means the
site stays working at all times — even when Sanity is empty.

When you've added enough content in Studio to replace placeholders, edit `.env`:

```
USE_SANITY=true
```

Restart `npm run dev`. Pages now hydrate from Sanity. If a query returns nothing,
that section falls back to placeholder data automatically — no broken pages.

## What's in here

```
src/
├── data/              # placeholder content (mirrors Sanity shapes in /sanity)
├── components/        # Header, Footer, Hero, ImageGrid, TicketTailorEmbed, …
├── layouts/Base.astro
├── pages/             # index, activities, 2025-edition, 2025-winners/*, about
└── styles/global.css  # Tailwind v4 + custom CSS variables (theme)

sanity/
├── schemas/           # Sanity content schemas (to copy into Sanity Studio later)
└── README.md
```

The site currently reads from `src/data/*.ts`. Those files are typed to match
the Sanity schemas in `sanity/schemas/`, so when you migrate the data source,
only the imports change — pages stay the same.

## The stack (and why)

| Layer | Choice | Free? |
|---|---|---|
| Framework | Astro 5 + Tailwind 4 | Yes |
| CMS | Sanity (hosted) | Yes — 20 seats, 10k docs, 5 GB assets free |
| Hosting | Cloudflare Pages | Yes — unlimited bandwidth, 500 builds/mo |
| Ticketing | Ticket Tailor | €0.65 per paid ticket (pass to buyer); free for free events |
| Payments | Stripe (via Ticket Tailor) | Per-transaction only |
| Newsletter | MailerLite | Yes — up to 1k subscribers |

Total fixed cost: **~€15/yr** (domain).

## Next steps to go live

### 1. Sanity Studio is already wired

See "Run the CMS" above. The studio lives in `studio/`, project ID `nsxw1yrt`,
dataset `production`. Schemas are pre-populated. Just `cd studio && npm install
&& npm run dev`.

### 2. Front the Sanity image CDN with Cloudflare

This is the single most important step to keep Sanity's 10 GB/mo bandwidth
limit from ever being a concern. Set up a Cloudflare Worker on
`images.lspf.photo` that proxies to `cdn.sanity.io`:

```js
// worker.js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const upstream = `https://cdn.sanity.io${url.pathname}${url.search}`;
    return fetch(upstream, {
      cf: { cacheTtl: 60 * 60 * 24 * 30, cacheEverything: true },
    });
  },
};
```

Cloudflare caches each image at the edge for ~30 days. After the first hit,
Sanity is not touched. Then in your image helper, rewrite URLs:

```ts
const cdn = (sanityUrl: string) =>
  sanityUrl.replace("https://cdn.sanity.io", "https://images.lspf.photo");
```

### 3. Set up Ticket Tailor

1. Create account at <https://www.tickettailor.com>
2. Connect Stripe (under Settings → Payments)
3. Create each event (workshop, photowalk, talk)
4. For each event: Distribute → Widget → copy the **event ID**
5. Paste it into the matching `workshop` document in Sanity
   (`ticketTailorEventId` field)

The `TicketTailorEmbed` component (in `src/components/`) automatically swaps
the placeholder for a live widget once an ID is set.

### 4. Newsletter

Replace the `action` URL in `src/components/NewsletterForm.astro` with your
MailerLite (or other) embed form endpoint.

### 5. Deploy to Cloudflare Pages

```bash
# One-time:
npm install -g wrangler
wrangler pages project create lspf-website

# Or via the Cloudflare dashboard:
# - Connect this Git repo
# - Build command: npm run build
# - Build output: dist
# - Set env vars: SANITY_PROJECT_ID
```

Add a Sanity webhook to trigger a Cloudflare Pages rebuild on every publish:
Sanity → API → Webhooks → POST to the Cloudflare Pages deploy hook URL.

## Notes on the design

- **Typography**: Inter / Inter Tight from rsms.me (free, fast CDN). Self-host
  later if you want zero third-party requests.
- **Colors**: defined in `src/styles/global.css` as CSS variables
  (`--color-ink`, `--color-paper`, `--color-accent`). Tweak there to rebrand
  the whole site.
- **Images**: `picsum.photos` is used as a placeholder image service. Every
  `<img>` tag in pages reads from a typed `ImageRef` (src, alt, width, height)
  — when Sanity is wired, the same shape comes from the CMS.
- **`noai, noimageai`** is set in `<meta name="robots">` so image-scraping
  bots are asked to skip — preserving the wishes from the current site.

## Visual identity

Open the mock and the current site side by side. The mock keeps the same
information architecture and image-forward feel, with:

- A more polished editorial typography stack (Inter Tight for display)
- Stronger use of whitespace
- An accent color (warm red `#d64545`) usable for the festival's visual
  identity — change in `global.css` if you'd rather not.

## What's deliberately missing from MVP

- Live Sanity wiring (schemas are defined; data layer is a typed stand-in)
- Multi-language (PT/EN)
- Real festival map / venue page
- Press kit / partner logos section
- Search

All easy to layer in once the foundation is approved.
