#!/usr/bin/env node
/**
 * Seed the Sanity project with the same placeholder content that the Astro
 * site shows. After this runs successfully and USE_SANITY=true is set,
 * the site reads from Sanity instead of src/data/*.ts.
 *
 * Prerequisites:
 *  1. Generate a write token: https://www.sanity.io/manage/project/nsxw1yrt/api
 *     → Tokens → "Add API token" → name it "Seed", permission "Editor"
 *  2. Add it to .env:
 *       SANITY_AUTH_TOKEN=sk...
 *  3. From the project root:  npm run seed
 *
 * Idempotency: documents use deterministic IDs (e.g. `workshop.alfama-photowalk`),
 * so running this script multiple times updates the same documents in place
 * rather than creating duplicates.
 */

import { createClient } from "@sanity/client";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

const token = process.env.SANITY_AUTH_TOKEN;
if (!token) {
  console.error(
    "✗ SANITY_AUTH_TOKEN missing. Generate at:\n" +
      "  https://www.sanity.io/manage/project/nsxw1yrt/api\n" +
      "and add to .env",
  );
  process.exit(1);
}

const client = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID ?? "nsxw1yrt",
  dataset: process.env.PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2025-01-01",
  token,
  useCdn: false,
});

const img = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** Sanity document IDs must be ASCII [a-zA-Z0-9._-]. Strip diacritics. */
const idSafe = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase();

/** Upload a remote image URL to Sanity and return an image field value. */
async function uploadImage(url, filename) {
  console.log(`  ↑ ${filename}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const asset = await client.assets.upload("image", buffer, {
    filename,
    contentType: res.headers.get("content-type") ?? "image/jpeg",
  });
  return {
    _type: "image",
    asset: { _type: "reference", _ref: asset._id },
  };
}

/* ---------------------------------------------------------------------- */
/* Content to seed (mirrors src/data/*.ts)                                 */
/* ---------------------------------------------------------------------- */

const editions = [
  {
    _id: "edition.2026",
    _type: "edition",
    year: 2026,
    slug: { _type: "slug", current: "2026" },
    tagline: "Rooted in Lisbon. Open to the world.",
    startDate: "2026-09-25",
    endDate: "2026-09-27",
    heroImageSeed: { seed: "lspf-2026-hero", w: 2400, h: 1500 },
    introText:
      "From 25–27 September 2026, we'll meet in Lisbon for the second edition of Lisbon Street Photo Fest: a celebration of street photography, bringing together photographers, enthusiasts, and curious minds from around the world.",
    openCallUrl: "https://site.picter.com/lisbon-street-photo-fest-2026",
    openCallDeadline: "2026-05-31",
  },
  {
    _id: "edition.2025",
    _type: "edition",
    year: 2025,
    slug: { _type: "slug", current: "2025" },
    tagline: "The first edition.",
    startDate: "2025-09-26",
    endDate: "2025-09-28",
    heroImageSeed: { seed: "lspf-2025-hero", w: 2400, h: 1500 },
    introText:
      "The inaugural Lisbon Street Photo Fest brought together hundreds of photographers across three days of exhibitions, talks, workshops and photowalks at Faculdade de Belas-Artes.",
  },
];

const workshops = [
  {
    slug: "street-essentials-with-maria-silva",
    title: "Street Essentials",
    kind: "workshop",
    instructor: "Maria Silva",
    startsAt: "2026-09-25T10:00:00+01:00",
    endsAt: "2026-09-25T17:00:00+01:00",
    location: "Faculdade de Belas-Artes, Lisboa",
    priceEUR: 120,
    capacity: 12,
    coverSeed: { seed: "workshop-street-essentials", w: 1600, h: 1000 },
    descriptionText:
      "A full-day intensive on composition, anticipation, and light in the streets of Bairro Alto. Bring a camera and comfortable shoes.",
  },
  {
    slug: "alfama-photowalk",
    title: "Alfama Photowalk",
    kind: "photowalk",
    instructor: "João Pereira",
    startsAt: "2026-09-26T08:00:00+01:00",
    endsAt: "2026-09-26T12:00:00+01:00",
    location: "Largo do Chafariz de Dentro",
    priceEUR: 25,
    capacity: 20,
    coverSeed: { seed: "photowalk-alfama", w: 1600, h: 1000 },
    descriptionText:
      "A morning walk through Alfama's oldest streets, guided by a long-time resident photographer. Capacity is small to keep the group nimble.",
  },
  {
    slug: "talk-on-the-decisive-moment",
    title: "Talk: After the Decisive Moment",
    kind: "talk",
    instructor: "Panel of three festival photographers",
    startsAt: "2026-09-26T18:00:00+01:00",
    endsAt: "2026-09-26T19:30:00+01:00",
    location: "FBAUL Auditorium",
    priceEUR: 0,
    capacity: 200,
    coverSeed: { seed: "talk-decisive-moment", w: 1600, h: 1000 },
    descriptionText:
      "A conversation about what happens to the practice of street photography in an era when every second is photographed by someone. Free, but ticketed to manage capacity.",
  },
  {
    slug: "portfolio-reviews",
    title: "Portfolio Reviews",
    kind: "portfolio-review",
    instructor: "Rotating panel of curators and editors",
    startsAt: "2026-09-27T11:00:00+01:00",
    endsAt: "2026-09-27T17:00:00+01:00",
    location: "FBAUL Project Room",
    priceEUR: 45,
    capacity: 24,
    coverSeed: { seed: "portfolio-reviews", w: 1600, h: 1000 },
    descriptionText:
      "Twenty-minute one-on-one reviews with curators, magazine editors, and gallerists. Bring a print or digital portfolio of 10–15 images.",
  },
  {
    slug: "darkroom-zine-making",
    title: "Zine Making: From Edit to Print",
    kind: "workshop",
    instructor: "Inês Costa",
    startsAt: "2026-09-27T10:00:00+01:00",
    endsAt: "2026-09-27T16:00:00+01:00",
    location: "Tipografia Damasceno",
    priceEUR: 95,
    capacity: 10,
    coverSeed: { seed: "zine-making", w: 1600, h: 1000 },
    descriptionText:
      "Walk in with a folder of images, walk out with a printed and stitched zine. Materials included.",
  },
];

const singles2025 = [
  { slug: "a-quiet-corner", photographer: "Ana Ribeiro", country: "Portugal", seed: "single-1", caption: "A quiet corner. Mouraria, 2024.", award: "Winner" },
  { slug: "tram-window", photographer: "Hiro Tanaka", country: "Japan", seed: "single-2", caption: "Tram 28, near Estrela.", award: "Honourable mention" },
  { slug: "midday-shadow", photographer: "Léa Moreau", country: "France", seed: "single-3" },
  { slug: "after-rain", photographer: "Daniel Okafor", country: "Nigeria", seed: "single-4" },
  { slug: "two-old-friends", photographer: "Mateo Reyes", country: "Argentina", seed: "single-5" },
  { slug: "cabo-da-roca", photographer: "Pedro Antunes", country: "Portugal", seed: "single-6" },
  { slug: "the-blue-hour", photographer: "Sara Lindqvist", country: "Sweden", seed: "single-7" },
  { slug: "passers-by", photographer: "Jakub Nowak", country: "Poland", seed: "single-8" },
];

const series2025 = [
  {
    slug: "estrangeiros",
    photographer: "Sofia Marques",
    seriesTitle: "Estrangeiros",
    country: "Portugal",
    statementText:
      "A year photographing the long-time foreign residents of Lisbon — what they keep, what they leave behind.",
    seeds: ["series-est-1", "series-est-2", "series-est-3", "series-est-4"],
    award: "Winner",
  },
  {
    slug: "feiras-de-domingo",
    photographer: "Carlos Mendes",
    seriesTitle: "Feiras de Domingo",
    country: "Portugal",
    statementText: "Sunday markets across the Tejo valley, photographed over two seasons.",
    seeds: ["series-fdd-1", "series-fdd-2", "series-fdd-3", "series-fdd-4"],
  },
  {
    slug: "graça-after-midnight",
    photographer: "Inês Pinto",
    seriesTitle: "Graça After Midnight",
    country: "Portugal",
    statementText: "Late-night walks in the Graça neighbourhood.",
    seeds: ["series-gam-1", "series-gam-2", "series-gam-3"],
  },
];

const exhibitions2025 = [
  {
    slug: "open-call-2025",
    title: "Open Call 2025: Finalists",
    venue: "Faculdade de Belas-Artes, Sala de Exposições",
    openingDate: "2025-09-26",
    closingDate: "2025-10-12",
    coverSeed: "ex-opencall-cover",
    descriptionText:
      "The full collection of selected finalist works from the 2025 Open Call, hung salon-style across the main exhibition hall.",
    gallerySeeds: ["ex-opencall-1", "ex-opencall-2", "ex-opencall-3"],
  },
  {
    slug: "tagus-light",
    title: "Tagus Light: A Retrospective",
    venue: "Galeria Quadrum",
    openingDate: "2025-09-25",
    closingDate: "2025-10-25",
    coverSeed: "ex-tagus-cover",
    descriptionText:
      "Thirty years of Lisbon photography from the archives of three Portuguese street photographers.",
    gallerySeeds: ["ex-tagus-1", "ex-tagus-2"],
  },
];

/** Sanity Portable Text from plain string. */
const pt = (text) => [
  {
    _type: "block",
    _key: Math.random().toString(36).slice(2, 10),
    style: "normal",
    children: [
      {
        _type: "span",
        _key: Math.random().toString(36).slice(2, 10),
        text,
        marks: [],
      },
    ],
    markDefs: [],
  },
];

async function run() {
  console.log("• Uploading images and creating documents…\n");

  const tx = client.transaction();

  // --- Editions ---
  console.log("Editions:");
  const editionRefs = {};
  for (const ed of editions) {
    const hero = await uploadImage(
      img(ed.heroImageSeed.seed, ed.heroImageSeed.w, ed.heroImageSeed.h),
      `${ed._id}-hero.jpg`,
    );
    tx.createOrReplace({
      _id: ed._id,
      _type: "edition",
      year: ed.year,
      slug: ed.slug,
      tagline: ed.tagline,
      startDate: ed.startDate,
      endDate: ed.endDate,
      heroImage: hero,
      intro: pt(ed.introText),
      openCallUrl: ed.openCallUrl,
      openCallDeadline: ed.openCallDeadline,
    });
    editionRefs[ed.year] = ed._id;
  }

  // --- Workshops ---
  console.log("\nWorkshops:");
  for (const w of workshops) {
    const cover = await uploadImage(
      img(w.coverSeed.seed, w.coverSeed.w, w.coverSeed.h),
      `workshop.${w.slug}-cover.jpg`,
    );
    tx.createOrReplace({
      _id: `workshop.${idSafe(w.slug)}`,
      _type: "workshop",
      title: w.title,
      slug: { _type: "slug", current: w.slug },
      kind: w.kind,
      instructor: w.instructor,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      location: w.location,
      priceEUR: w.priceEUR,
      capacity: w.capacity,
      cover,
      description: pt(w.descriptionText),
    });
  }

  // --- Finalist singles 2025 ---
  console.log("\nFinalist singles 2025:");
  for (const f of singles2025) {
    const image = await uploadImage(
      img(f.seed, 1600, 1200),
      `single.${f.slug}.jpg`,
    );
    tx.createOrReplace({
      _id: `single.${idSafe(f.slug)}`,
      _type: "finalistSingle",
      photographer: f.photographer,
      slug: { _type: "slug", current: f.slug },
      country: f.country,
      image,
      caption: f.caption,
      year: 2025,
      award: f.award,
    });
  }

  // --- Finalist series 2025 ---
  console.log("\nFinalist series 2025:");
  for (const s of series2025) {
    const images = [];
    for (let i = 0; i < s.seeds.length; i++) {
      const u = await uploadImage(
        img(s.seeds[i], 1600, 1200),
        `series.${s.slug}.${i}.jpg`,
      );
      images.push({
        ...u,
        _key: `img-${i}`,
      });
    }
    tx.createOrReplace({
      _id: `series.${idSafe(s.slug)}`,
      _type: "finalistSeries",
      photographer: s.photographer,
      seriesTitle: s.seriesTitle,
      slug: { _type: "slug", current: s.slug },
      country: s.country,
      statement: pt(s.statementText),
      images,
      year: 2025,
      award: s.award,
    });
  }

  // --- Exhibitions 2025 ---
  console.log("\nExhibitions 2025:");
  for (const ex of exhibitions2025) {
    const cover = await uploadImage(
      img(ex.coverSeed, 1600, 1000),
      `exhibition.${ex.slug}-cover.jpg`,
    );
    const gallery = [];
    for (let i = 0; i < ex.gallerySeeds.length; i++) {
      const u = await uploadImage(
        img(ex.gallerySeeds[i], 1600, 1000),
        `exhibition.${ex.slug}.${i}.jpg`,
      );
      gallery.push({ ...u, _key: `g-${i}` });
    }
    tx.createOrReplace({
      _id: `exhibition.${idSafe(ex.slug)}`,
      _type: "exhibition",
      title: ex.title,
      slug: { _type: "slug", current: ex.slug },
      year: 2025,
      venue: ex.venue,
      openingDate: ex.openingDate,
      closingDate: ex.closingDate,
      cover,
      description: pt(ex.descriptionText),
      gallery,
    });
  }

  // --- Site settings ---
  console.log("\nSite settings:");
  tx.createOrReplace({
    _id: "siteSettings",
    _type: "siteSettings",
    siteName: "Lisbon Street Photo Fest",
    tagline: "Learning from the streets through photography.",
    currentEdition: { _type: "reference", _ref: editionRefs[2026] },
    nav: [
      {
        _key: "n1",
        label: "2026 Open Call",
        href: "https://site.picter.com/lisbon-street-photo-fest-2026",
      },
      { _key: "n2", label: "Activities", href: "/activities" },
      { _key: "n3", label: "2025 Edition", href: "/2025-edition" },
      { _key: "n4", label: "About", href: "/about" },
    ],
    instagram: "https://instagram.com/lisbonstreet.photo",
    contactEmail: "hello@lisbonstreet.photo",
  });

  console.log("\n• Committing transaction…");
  await tx.commit();
  console.log("✓ Seed complete.\n");
  console.log("Next steps:");
  console.log("  1. Set USE_SANITY=true in .env (already set if you used .env.example)");
  console.log("  2. Restart  npm run dev");
  console.log("  3. Refresh http://localhost:4321 — content is now coming from Sanity.");
}

run().catch((err) => {
  console.error("\n✗ Seed failed:", err);
  process.exit(1);
});
