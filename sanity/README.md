# Sanity Studio (not yet wired)

These are **content schema drafts**. They define the shape of the data that
Sanity Studio will manage and that the Astro frontend will query.

The Astro site currently reads from `src/data/*.ts` (static placeholder data
shaped like Sanity's responses). When you're ready to switch to live Sanity:

1. Run `npm create sanity@latest -- --project-id <your-id> --dataset production`
   in a sibling `studio/` folder (keep the frontend repo separate, or use a
   monorepo).
2. Copy the schemas from `sanity/schemas/*.ts` into the studio's `schemas/`
   folder and export them from `schemaTypes/index.ts`.
3. Install `@sanity/client` in the Astro project:
   ```
   npm install @sanity/client
   ```
4. Replace the imports in `src/pages/*.astro` from
   `import { ... } from "@/data/..."` to GROQ queries via the Sanity client.
5. Add `cdn.sanity.io` to `astro.config.mjs` under `image.domains`.
6. Set up a Cloudflare Worker route (see project README) to proxy
   `images.lspf.photo/*` → `cdn.sanity.io/*` so visitor traffic never hits
   Sanity's bandwidth quota.

## Schema overview

- **edition.ts** — a year of the festival (e.g. 2025, 2026): hero, dates,
  tagline, blurbs, references to workshops/exhibitions/finalists for that year
- **workshop.ts** — workshops, photowalks, talks. Includes Ticket Tailor event
  ID for embedding the ticket widget.
- **finalistSingle.ts** — one finalist photo (Singles category)
- **finalistSeries.ts** — one finalist series (Series category, multiple photos)
- **exhibition.ts** — one exhibition during the festival
- **page.ts** — generic content pages (About, Contact, etc.)
- **siteSettings.ts** — site-wide config: logo, nav, footer, social
