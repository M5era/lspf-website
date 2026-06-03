#!/usr/bin/env node
/**
 * Import a copy of everything from www.lisbonstreet.photo into Sanity.
 *
 * What this does:
 *  - Optionally wipes the existing Sanity content (`--clean`)
 *  - Downloads images from format.creatorcdn.com
 *  - Uploads them to Sanity as assets
 *  - Creates documents: editions, singles finalists, series finalists,
 *    exhibitions, about page, site settings
 *
 * Run:
 *  npm run import           # idempotent, will overwrite same-ID docs
 *  npm run import -- --clean  # delete existing docs first
 *
 * Requires SANITY_AUTH_TOKEN with Editor permission (set in .env).
 *
 * This script is data-heavy and self-contained; expect 3-8 minutes runtime
 * depending on network.
 */

import { createClient } from "@sanity/client";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ---------- env ----------
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

const token = process.env.SANITY_AUTH_TOKEN;
if (!token) {
  console.error("✗ SANITY_AUTH_TOKEN required (Editor scope).");
  process.exit(1);
}
const CLEAN = process.argv.includes("--clean");

const client = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID ?? "nsxw1yrt",
  dataset: process.env.PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2025-01-01",
  token,
  useCdn: false,
});

// ---------- helpers ----------
const idSafe = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase();

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

async function uploadImage(url, filename, attempt = 1) {
  process.stdout.write(`  ↑ ${filename} `);
  let buffer;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (isTransient(err) && attempt < 5) {
      const wait = 2000 * attempt;
      process.stdout.write(`(fetch ${err.code ?? err.message}, retry in ${wait}ms)\n`);
      await new Promise((r) => setTimeout(r, wait));
      return uploadImage(url, filename, attempt + 1);
    }
    throw err;
  }
  try {
    const asset = await client.assets.upload("image", buffer, {
      filename,
      contentType: "image/jpeg",
    });
    process.stdout.write("✓\n");
    return {
      _type: "image",
      asset: { _type: "reference", _ref: asset._id },
    };
  } catch (err) {
    if (isTransient(err) && attempt < 5) {
      const wait = 2000 * attempt;
      process.stdout.write(`(upload ${err.statusCode ?? err.code ?? err.message}, retry in ${wait}ms)\n`);
      await new Promise((r) => setTimeout(r, wait));
      return uploadImage(url, filename, attempt + 1);
    }
    throw err;
  }
}

function isTransient(err) {
  const code = err?.code ?? err?.cause?.code;
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EAI_AGAIN" ||
    code === "ENOTFOUND" ||
    code === "UND_ERR_SOCKET" ||
    code === "UND_ERR_CONNECT_TIMEOUT"
  )
    return true;
  const status = err?.statusCode;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  return false;
}

// ---------- fresh URL resolver ----------
// Format CDN signed URLs are short-lived. Each run re-scrapes the lspf.photo
// pages to get currently-valid URLs, looking them up by stable asset UUID.

const PAGE_CACHE = {};

async function getPageHtml(path) {
  if (PAGE_CACHE[path]) return PAGE_CACHE[path];
  const url = `https://www.lisbonstreet.photo${path}`;
  console.log(`  ↓ fetching ${path}`);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
    },
  });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  PAGE_CACHE[path] = await res.text();
  return PAGE_CACHE[path];
}

function extractAssetId(url) {
  const m = url.match(
    /\/0-0-0\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//,
  );
  return m ? m[1] : null;
}

function findFreshUrl(html, assetId) {
  // Strict URL pattern: stops exactly at the 64-hex-char hmac, so we don't
  // capture trailing HTML-encoded JSON content from Format's data attributes.
  const regex = new RegExp(
    `https://format\\.creatorcdn\\.com/[\\w/,.+%~-]*?/${assetId}/[\\w/,.+%~-]*?\\?fjkss=exp=\\d+~hmac=[a-f0-9]{64}`,
    "g",
  );
  const urls = html.match(regex) || [];
  if (urls.length === 0) return null;
  const sized = urls.map((u) => {
    const m = u.match(/\/\d+,\d+,\d+,\d+,(\d+),(\d+)\/0-0-0\//);
    const area = m ? parseInt(m[1]) * parseInt(m[2]) : 0;
    return { url: u, area };
  });
  sized.sort((a, b) => b.area - a.area);
  return sized[0].url;
}

async function freshUrl(staleUrl, pagePath) {
  const assetId = extractAssetId(staleUrl);
  if (!assetId) throw new Error(`No assetId in: ${staleUrl}`);
  const html = await getPageHtml(pagePath);
  const fresh = findFreshUrl(html, assetId);
  if (!fresh) throw new Error(`Asset ${assetId} not on ${pagePath}`);
  return fresh;
}

/** Look up an asset by ID on a page, trying multiple pages if needed. */
async function freshUrlByAssetId(assetId, pagePaths) {
  for (const path of pagePaths) {
    const html = await getPageHtml(path);
    const u = findFreshUrl(html, assetId);
    if (u) return u;
  }
  throw new Error(`Asset ${assetId} not found on ${pagePaths.join(", ")}`);
}

// ---------- content (everything crawled from the live site) ----------
const F = "https://format.creatorcdn.com/07d76fef-7923-45d8-af7f-d7f464fd7bac/0/0/0";

const editions = [
  {
    _id: "edition.2026",
    year: 2026,
    slug: "2026",
    tagline: "Rooted in Lisbon. Open to the world.",
    startDate: "2026-09-25",
    endDate: "2026-09-27",
    pagePath: "/",
    heroUrl: `${F}/0,0,1723,1291,1600,1291/0-0-0/b0074639-2efa-4565-bfba-494d5723da6b/1/1/kites.jpg`,
    introText:
      "From 25–27 September 2026, we'll meet in Lisbon for the second edition of Lisbon Street Photo Fest: a celebration of street photography, bringing together photographers, enthusiasts, and curious minds from around the world.",
    openCallUrl: "https://site.picter.com/lisbon-street-photo-fest-2026",
    openCallDeadline: "2026-05-31",
  },
  {
    _id: "edition.2025",
    year: 2025,
    slug: "2025",
    tagline: "The first edition.",
    startDate: "2025-09-26",
    endDate: "2025-09-28",
    pagePath: "/",
    heroUrl: `${F}/0,0,1200,798,1600,798/0-0-0/d34013d8-1929-4b18-aabc-2e9724eb63d3/1/1/auditorium-audience.jpg`,
    introText:
      "The inaugural Lisbon Street Photo Fest brought together hundreds of photographers across three days of exhibitions, talks, workshops and photowalks at Faculdade de Belas-Artes.",
  },
];

const singlesPage = "/open-call-singles-2025";
const editionPage = "/2025-edition";
const singlesSponsorPage = "/open-call-singles-2025";

// People (headliners, workshop instructors, portfolio reviewers, photowalk
// leaders, spotlight talks, Open Call jury) — extracted from /2025-edition.
const people = [
  { id: "person.alex-webb-rebecca-norris-webb", name: "Alex Webb & Rebecca Norris-Webb", url: "https://webbnorriswebb.co/", assetId: "124757ae-f559-4859-9650-c15c533cd0ec", roles: ["headliner", "jury"] },
  { id: "person.myriam-boulos", name: "Myriam Boulos", subtitle: "Magnum Photos", url: "https://www.magnumphotos.com/photographer/myriam-boulos/", assetId: "e3d5b419-f566-461f-a862-f8a292382e2d", roles: ["headliner"] },
  { id: "person.nikita-teryoshin", name: "Nikita Teryoshin", url: "https://nikitateryoshin.com/", assetId: "1c56c236-9c41-48b5-9ed9-784d034f6a5c", roles: ["headliner", "workshop", "jury"] },
  { id: "person.phil-penman", name: "Phil Penman", url: "https://www.philpenman.com", assetId: "25be151c-ce9a-493b-9e6b-7dc1d46d215a", roles: ["headliner"] },
  { id: "person.gustavo-minas", name: "Gustavo Minas", url: "https://www.gustavominas.com/", assetId: "34812149-23b6-4e3c-868a-7e6b92a18778", roles: ["workshop", "jury"] },
  { id: "person.matt-stuart", name: "Matt Stuart", url: "https://www.mattstuart.com/", assetId: "05253101-8d10-4696-9ef2-b05c9b0912e9", roles: ["workshop"] },
  { id: "person.jose-sarmento-matos", name: "José Sarmento Matos", url: "https://www.josesmatos.com/", assetId: "98542fcf-f1a3-4505-89b2-7a5e9eadc6fd", roles: ["workshop"] },
  { id: "person.sandra-hernandez", name: "Sandra Hernández", url: "https://vitaflumen.com/", assetId: "148f1950-7900-456b-a3a8-4ce14a1e3cf8", roles: ["workshop", "spotlight-talk"] },
  { id: "person.diogo-coelho", name: "Diogo Coelho", url: "http://www.instagram.com/di0g0c0elh0", assetId: "aee41269-7cd9-4d07-8e14-8f031d0be687", roles: ["workshop"] },
  { id: "person.rui-pina", name: "Rui Pina", subtitle: "gothic_porto", url: "https://www.instagram.com/gothic_porto", assetId: "1be05f69-cd39-49e2-8333-1b9ae6df4c03", roles: ["workshop"] },
  { id: "person.four-eyes-editions", name: "Four Eyes Éditions", url: "https://foureyeseditions.shop/", assetId: "5fa5a9fd-2221-46e4-93f0-a6e96d30e3f8", roles: ["workshop"] },
  { id: "person.shane-taylor", name: "Shane Taylor", subtitle: "Framelines Magazine", url: "https://frame-lines.com/", assetId: "8cf09d78-7dee-467b-90c9-e40c818ee729", roles: ["portfolio-review", "photowalk"] },
  { id: "person.mario-cruz", name: "Mário Cruz", subtitle: "Narrativa", url: "https://www.mario-cruz.com/", assetId: "7ba4df86-4e1a-4af1-b2a5-a58654fd3942", roles: ["portfolio-review", "jury"] },
  { id: "person.sigrid-debusschere", name: "Sigrid Debusschere", subtitle: "BSPF", url: "https://www.bspfestival.org/", assetId: "6c00117f-4797-458c-9466-7ce80ffc0be4", roles: ["portfolio-review"] },
  { id: "person.alise-careva", name: "Alise Careva", subtitle: "In the Pink", url: "https://www.in-the-pink.com/", assetId: "144b7bfa-8364-4d47-90c6-5a8eb37c2618", roles: ["portfolio-review"] },
  { id: "person.arlindo-camacho", name: "Arlindo Camacho", url: "https://www.arlindocamacho.com/around-the-world", assetId: "176bed26-3bf5-49e8-b481-bcd86d97cf7b", roles: ["photowalk", "spotlight-talk"] },
  { id: "person.billy-dinh", name: "Billy Dinh", subtitle: "Finalist", url: "https://www.billydinh.com/", assetId: "92067099-7db0-4a44-8110-99b26c68722f", roles: ["photowalk"] },
  { id: "person.efi-longinou", name: "Efi Longinou", url: "https://www.instagram.com/efi_o/", assetId: "4be709ce-affe-4d1a-b6cf-f7bd61850d86", roles: ["photowalk", "spotlight-talk"] },
  { id: "person.joao-bernardino", name: "João Bernardino", url: "https://www.instagram.com/joao.bernardino", assetId: "f1616f9b-f195-43c1-9d62-b4f74f19024f", roles: ["photowalk"] },
  { id: "person.robbie-mcintosh", name: "Robbie McIntosh", url: "https://robbiemcintosh.net/robbie-mcintosh", assetId: "4a4931c9-512f-49a9-8acb-c51adca8b8be", roles: ["photowalk", "spotlight-talk"] },
  { id: "person.pau-buscato", name: "Pau Buscató", url: "https://www.instagram.com/paubuscato", assetId: "d5a632d1-4850-4442-b6d2-333d5314ec78", roles: ["photowalk", "spotlight-talk"] },
  { id: "person.jorge-chagas", name: "Jorge Chagas", url: "https://www.instagram.com/jorgemchagas", assetId: "56251ea9-caf5-4046-9e4e-512552093e03", roles: ["photowalk"] },
  { id: "person.jorge-garcia", name: "Jorge Garcia", url: "https://www.photosbyjorge.com/", assetId: "0337d701-37a9-4bc6-9d21-7675e186a2b9", roles: ["photowalk"] },
  { id: "person.paul-murray", name: "Paul Murray", subtitle: "Finalist", url: "https://www.reflexlens.com/", assetId: "cb7a0677-9f19-47a2-b643-7b32e946b7ba", roles: ["photowalk"] },
  { id: "person.rui-miguel-cunha", name: "Rui Miguel Cunha", url: "https://www.instagram.com/ruimiguelcunha/", assetId: "28dcf61b-1ca0-4507-b9d7-b68e7e1c25cc", roles: ["spotlight-talk"] },
  { id: "person.ana-paganini", name: "Ana Paganini", url: "https://www.anapaganini.com/", assetId: "af470eb1-e0c0-4a13-8424-735a8a932572", roles: ["spotlight-talk"] },
  { id: "person.julia-coddington", name: "Julia Coddington", subtitle: "Women in Street", url: "https://www.juliacoddington.com/", assetId: "b8293da2-71ba-4acb-b2ef-a56420505ce4", roles: ["jury"] },
  { id: "person.julia-martin", name: "Julia Martin", subtitle: "Format", url: "https://www.format.com/magazine", assetId: "43af5eaf-b31c-45a7-b924-689fd464e0bb", roles: ["jury"] },
];

// Sponsors (logos appear on /2025-edition and /open-call-singles-2025).
const sponsors = [
  { id: "sponsor.fujifilm", name: "Fujifilm", url: "https://www.fujifilm.com/pt/pt-pt", tier: "Headline sponsor", assetId: "607154d1-fa11-44ca-9a14-a37fe780ea4b", order: 1 },
  { id: "sponsor.mpb", name: "MPB", tier: "Sponsor", assetId: "e44b0c69-dc20-4fd0-8674-515e828aa9e3", order: 2 },
  { id: "sponsor.embaixada-brasil", name: "Embaixada do Brasil", tier: "Sponsor", assetId: "59a25767-8718-43c3-af74-19e738952702", order: 3 },
  { id: "sponsor.labkorner", name: "LabKorner", url: "https://en.labkorner.com/", tier: "Production", assetId: "61a32655-d19e-4744-a14d-cb3ee223b4d0", order: 4 },
  { id: "sponsor.fbaul", name: "FBAUL", url: "https://www.belasartes.ulisboa.pt/en/galeria/", tier: "Venue", assetId: "7a36abb0-f594-4ab9-813d-bcee398234e5", order: 5 },
  { id: "sponsor.colorfoto", name: "Colorfoto", url: "https://www.colorfoto.pt/", tier: "Presenter", assetId: "33196320-4146-42c8-858c-eef4825a63cd", order: 6 },
  { id: "sponsor.belem", name: "Belém", tier: "Sponsor", assetId: "eff94265-8107-4c09-a820-c34d3014a4d5", order: 7 },
  { id: "sponsor.format", name: "Format", url: "https://www.format.com/", tier: "Awards", assetId: "b44d2b2e-0dbd-4093-94b1-d2f3b8f35818", order: 8 },
  { id: "sponsor.ermelinda", name: "Ermelinda", tier: "Sponsor", assetId: "c1bb0e5f-85d6-4895-b459-dee56754fecc", order: 9 },
  { id: "sponsor.crown-and-flint", name: "Crown and Flint", tier: "Sponsor", assetId: "ff724551-869e-4406-9d61-dc289f0f2bb1", order: 10 },
  { id: "sponsor.narrativa", name: "Narrativa", url: "https://anarrativa.com/", tier: "Curation", assetId: "938dbd61-0a38-4b46-a16f-d21cb6f2e345", order: 11 },
  { id: "sponsor.arte-de-arcos", name: "Arte de Arcos", url: "https://artedearcos.com/", tier: "Frames", assetId: "6f6a0ad6-b94f-4bfb-9365-fef5c9e51ea2", order: 12 },
];

// All 33 Singles finalists in order they appear on
// https://www.lisbonstreet.photo/open-call-singles-2025
const singles = [
  // Winners (highlighted at top of page)
  { id: "single.marika-poquet-harbour-of-hustle", photographer: "Marika Poquet", title: "Harbour of Hustle", award: "Winner (1st place)", url: `${F}/0,0,1500,999,1500,1200/0-0-0/75231fa9-cc08-4979-8482-fa5657627ebf/1/1/Marika+-+-+8+-+Harbour+of+hustle+-+286fae99-b02d-4f41-aa65-0728d24094c8.jpg?fjkss=exp=2095529172~hmac=cf17ac006a92eb0ab7bff2e54e337fea44025077be775300c040ee40f4f69a2d` },
  { id: "single.latife-baudet-portrait-child", photographer: "Latife Baudet", title: "Untitled (LatifeBaudet1)", award: "2nd place", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/fa9a85d6-e1de-4cc2-883c-eb0d6c622a14/1/1/Latife+Solak+Baudet+-+-+4+-+LatifeBaudet1+-+16924239-53dc-4d85-8764-53206a94036b.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.andrea-klausner-before-the-parade", photographer: "Andrea Klausner", title: "Before the Parade", award: "3rd place", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/7627017b-e4de-41c0-a32d-c3ae5b2dcae7/1/1/Andrea+Klausner+-+-+9+-+Before+the+Parade+-+392b3d48-cb25-4327-b073-23289aa8ae3c.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },

  // Other finalists
  { id: "single.sakulchai-umbrella", photographer: "Sakulchai", title: "Umbrella", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/2f085c5c-d1c0-47f2-b1fa-ec58fb754218/1/1/sakulchai+-+-+33+-+umbrella.+-+eb9d04e0-2807-469b-816c-ff2ab41f3cce.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.gavin-libotte-time-to-serve-up-the-moon", photographer: "Gavin Libotte", title: "Time to Serve Up The Moon", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/89457f01-0802-43b8-8227-7c31e0ccf490/1/1/Gavin+Libotte+-+-+31+-+Time+to+Serve+Up+The+Moon+-+e8b10b0c-b2be-449f-bac5-f6a5c041d560.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.paul-murray-7", photographer: "Paul Murray", title: "Paul_Murray7", url: `${F}/0,0,1500,998,1500,1200/0-0-0/2ef6c064-fc68-4348-9f44-f999b7630f58/1/1/Paul+Murray+-+-+32+-+Paul_Murray7+-+e97e607c-bdc5-480b-aa72-81b51fb5920b.jpg?fjkss=exp=2095529172~hmac=a574e75761195de57d402f04cbb3de5dc4ca51c4cb6e5c587f2a1d36165ee136` },
  { id: "single.marika-in-the-shadow-of-the-bid", photographer: "Marika", title: "In the Shadow of the Bid", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/39f1adda-691b-44f5-9569-b8dbefe10b54/1/1/Marika+-+-+30+-+In+the+shadow+of+the+bid+-+e3dc7c67-3968-4a40-9c8f-c09bb615cbdc.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.bert-de-busschere-2", photographer: "Bert De Busschere", title: "Bert_De_Busschere_Singles_2", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/341d3db4-fa5b-4c59-9bb8-27001bf53348/1/1/Bert+De+Busschere+-+-+28+-+Bert_De_Busschere_Singles_2+-+d0c19dba-2e0e-435d-abc2-194abb7d3c8d.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.andrea-klausner-one-eyed-boy", photographer: "Andrea Klausner", title: "One-Eyed Boy", url: `${F}/0,0,1000,1500,1500,1500/0-0-0/79b9c01a-16c4-45d1-98df-dc3e0b1f817c/1/1/Andrea+Klausner+-+-+29+-+One-Eyed+Boy+-+d7e4749e-4e13-4db3-a8c4-a5d73108adc4.jpg?fjkss=exp=2095529172~hmac=2442f16a9eeea4abb495accf427db13f250660cf9b8e54d1e04db4e61e6d93d9` },
  { id: "single.levi-goldbaum-cowboy-love", photographer: "Levi Goldbaum", title: "Cowboy Love", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/ccb37980-64da-4801-85b8-88043cf2c3c0/1/1/Levi+goldbaum+-+-+27+-+Cowboy+Love+-+cd68989a-161e-4629-af13-85f7b6de7b52.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.france-leclerc-full-swing", photographer: "France Leclerc", title: "Full Swing", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/7ba58299-c71d-4698-8a9a-ff3cdd3e2350/1/1/France+Leclerc+-+-+26+-+Full+Swing+-+c0fbc0c6-cb3c-42e3-9fe0-74634a5d110f.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.arez-prod-2", photographer: "Arez Prod", title: "PROD_AREZ_2", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/b5079fd6-b0b3-48cf-8cf9-f6b089b88cd9/1/1/arez+prod+-+-+25+-+PROD_AREZ_2+-+ae0ffb6c-aa63-4d9e-8b6b-73ae1cb87bb0.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.andrew-glickman-embrace", photographer: "Andrew Z Glickman", title: "Untitled — an embrace after the wedding", url: `${F}/0,0,1500,999,1500,1200/0-0-0/252dba42-aeda-4c42-9245-e919a0bc6b48/1/1/Andrew+Z+Glickman+-+-+24+-+Untitled+-an+embrace+after+the+wedding-+-+a9242816-02ef-415f-9728-5bf4fe9ad13e.jpg?fjkss=exp=2095529172~hmac=cf17ac006a92eb0ab7bff2e54e337fea44025077be775300c040ee40f4f69a2d` },
  { id: "single.till-death-do-us-part", photographer: "Finalist", title: "Till Death Do Us Part", url: `${F}/0,0,3643,2429,3643,1200/0-0-0/a814afb8-7176-4125-9506-a13a591a9072/1/1/Till+Death+Do+Us+Part.jpg?fjkss=exp=2095529172~hmac=e0233316db1a5112ed5c885109c8464e1f4004ce8b9c54397668f863fc8b5079` },
  { id: "single.marco-cajazzo-upside-down", photographer: "Marco Cajazzo", title: "Upside Down", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/df0fe384-5047-4b81-b128-25e9e695e66a/1/1/Marco+Cajazzo+-+-+22+-+Upside+down+-+980b4e4f-3b43-49e5-ab7d-ecbea6de0141.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.levi-goldbaum-plane-overload", photographer: "Levi Goldbaum", title: "Plane Overload", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/2addd9b0-db08-4646-b923-5615352e40fa/1/1/Levi+goldbaum+-+-+21+-+Plane+Overload+-+84a6df26-c1e4-4f89-ab0d-cef9428f651f.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.jfk-standing-still-in-time", photographer: "JFK", title: "Standing Still in Time", url: `${F}/0,0,1500,1001,1500,1200/0-0-0/68d7af81-52b9-40e6-91a7-cb989ab6e313/1/1/jfk+-+-+20+-+-Standing+still+in+time-+-+801cad1f-6c76-4c68-b7b1-49f45ebbcebf.jpg?fjkss=exp=2095529172~hmac=c65e8d827eb01a39668b623143e0d9dec9ff939391e6c2247e6e6085caf9956c` },
  { id: "single.andrea-klausner-market-day", photographer: "Andrea Klausner", title: "Market Day", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/5745899b-be01-4495-a62e-0c6e476f12de/1/1/Andrea+Klausner+-+-+18+-+Market+Day+-+70b3a0c7-1d55-43bc-a06f-bbf1556e5c35.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.sudeep-lal-joy-in-motion", photographer: "Sudeep Lal", title: "Joy in Motion", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/aba766d1-7dbc-437d-95b6-d922d2c1d696/1/1/Sudeep+Lal+-+-+19+-+Joy+in+Motion+-+711cd043-2822-4421-805c-2a3b4527ba58.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.france-leclerc-head-ball", photographer: "France Leclerc", title: "Head Ball", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/de0293dc-edbc-4548-9e13-e2f52e749d2f/1/1/France+Leclerc+-+-+17+-+Head+Ball+-+6ed76e22-86d9-4a74-929e-1b4ea0a9631b.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.sebastien-durand-all-terrain-shoes", photographer: "Sebastien Durand", title: "All-terrain Shoes", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/3441e0e2-f96f-469c-b095-ed2c4243f1d8/1/1/SEBASTIEN+DURAND+-+-+15+-+All-terrain+shoes+-+65b84bd9-c2f2-4e1c-b09e-43805196fafc.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.emiliano-cuadrado-moving", photographer: "Emiliano Cuadrado", title: "Moving", url: `${F}/0,0,3643,2429,3643,1200/0-0-0/f6f7f48b-94c8-408e-88ed-9138c715c91e/1/1/Emiliano_Cuadrado_Moving_HighRes.jpg?fjkss=exp=2095529172~hmac=e0233316db1a5112ed5c885109c8464e1f4004ce8b9c54397668f863fc8b5079` },
  { id: "single.neighborly-love", photographer: "Finalist", title: "Neighborly Love", url: `${F}/0,0,3643,2429,3643,1200/0-0-0/b1209819-d1ec-4a70-b924-4bd342a8cbf9/1/1/Neighborly+Love.jpg?fjkss=exp=2095529172~hmac=e0233316db1a5112ed5c885109c8464e1f4004ce8b9c54397668f863fc8b5079` },
  { id: "single.michael-eugster-wedding-photo", photographer: "Michael Eugster", title: "Wedding Photo", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/279e4ff0-e639-41c9-bbf5-2effd0f309d4/1/1/Michael+Eugster+-+-+14+-+Wedding+photo+-+565baed6-90ed-4c76-b540-371b1c002245.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.bert-de-busschere-1", photographer: "Bert De Busschere", title: "Bert_De_Busschere_Singles_1", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/182f4906-ab73-4736-b709-cf71290f90ac/1/1/Bert+De+Busschere+-+-+13+-+Bert_De_Busschere_Singles_1+-+4cf7e15a-c2b6-461f-b5e5-5c3a90e5985a.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.paul-murray-6", photographer: "Paul Murray", title: "Paul_Murray6", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/c08e09c1-0ab4-48d4-a631-0b59e4797061/1/1/Paul+Murray+-+-+11+-+Paul_Murray6+-+46e42ee3-940c-4491-9a96-9378045b131d.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.malgorzata-szura-piwnik-holiday-memories", photographer: "Małgorzata Szura Piwnik", title: "Holiday Memories", url: `${F}/0,0,1500,1001,1500,1200/0-0-0/29252439-5592-467c-af9a-e7133cbf5d31/1/1/Ma%C5%82gorzata+Szura+Piwnik+-+-+12+-+Holiday+memories+-+4c57f6a8-0224-451a-a2eb-12775983f70e.jpg?fjkss=exp=2095529172~hmac=c65e8d827eb01a39668b623143e0d9dec9ff939391e6c2247e6e6085caf9956c` },
  { id: "single.levi-goldbaum-the-great-escape", photographer: "Levi Goldbaum", title: "The Great Escape", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/290c3123-c98c-468e-acf8-02a921e8342f/1/1/Levi+goldbaum+-+-+10+-+The+Great+Escape+-+45d05f05-3eb0-4402-8dd0-ef5bb5f932f9.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.forrest-walker-rio-de-janeiro", photographer: "Forrest Walker", title: "Rio de Janeiro, Brazil", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/bb83f44b-7c40-4558-b504-ac8625b16e9d/1/1/Forrest+Walker+-+-+6+-+Rio+de+Janeiro-+Brazil+-+1dfebbdb-f272-4f09-8b57-94219e56c74f.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.stephen-thompson-1", photographer: "Stephen Thompson", title: "Stephen_Thompson-1", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/54e1e7b1-73eb-439a-8d6c-fd2470f2e2eb/1/1/Stephen+Thompson+-+-+1+-+Stephen_Thompson-1+-+005d80c5-bd10-4137-af08-f35a0bc69b4d.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.marika-shadows-of-nizwa", photographer: "Marika", title: "Shadows of Nizwa", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/a5577301-ca9f-4871-b5e5-2e8184bcb315/1/1/Marika+-+-+5+-+Shadows+of+Nizwa+-+1bff1dcd-6a07-4675-9db7-63f1750a0c57.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.sebastien-durand-osmosis", photographer: "Sebastien Durand", title: "Osmosis", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/f0c7254a-f769-42b7-aed4-87e2f2559580/1/1/SEBASTIEN+DURAND+-+-+2+-+Osmosis+-+15ab33d6-398f-4478-ab47-324594358b95.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
  { id: "single.latife-baudet-6", photographer: "Latife Baudet", title: "LatifeBaudet6", url: `${F}/0,0,1500,1000,1500,1200/0-0-0/2bfdf87a-58f9-4705-81e0-70b7037a85fd/1/1/Latife+Solak+Baudet+-+-+3+-+LatifeBaudet6+-+15d6b570-650b-4a00-9420-aa5199294e8f.jpg?fjkss=exp=2095529172~hmac=b37894f93d3acb8ffd58de987269a378bed6ba0f57e333f3c0c7451aa9149c30` },
];

// 3 Series finalists with their full galleries
const series = [
  {
    id: "series.gavin-libotte-new-wave",
    pagePath: "/new-wave",
    photographer: "Gavin Libotte",
    seriesTitle: "New Wave",
    workYear: 2024,
    statementText:
      "In this series, Gavin Libotte delves into our existence in and around water on a more spiritual plane. He acknowledges that our human lives form part of something larger. He visualizes individuals as unique drops of water belonging to the life's ocean. According to him, we are swimming in an ocean of Prana, a field of Energy. He uses an underwater camera to draw nearer to subjects as they blend into the ocean. He probes the non-dual aspect of human existence, using water as the metaphor that binds us all as an expression of a single consciousness. The harsh Australian light is mirrored in the treatment of the images. Black and white construct an unusual backdrop for beach street photography; it renders the stage more ambiguous. Gavin observes that when people are engaged in an activity, they are very free and reveal more about their true nature.",
    imageUrls: [
      `${F}/0,0,1500,1125,1500,1200/0-0-0/febda5b1-375b-4f92-88eb-4cbd40a09077/1/1/1+-+Gavin_Libotte_01+-+e4ecfa8a-a321-4503-b21c-afce551379c3.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
      `${F}/0,0,1500,1125,1500,1200/0-0-0/64db9fe2-85ef-4ec5-875d-0565678ea74e/1/1/2+-+Gavin_Libotte_02+-+5df2ca5a-efa4-4137-804e-c858fca3e03b.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
      `${F}/0,0,1500,1125,1500,1200/0-0-0/57572fc0-21b3-4590-9f49-16b0d30be146/1/1/3+-+Gavin_Libotte_03+-+dce9e5f2-a462-41dc-984b-7408302e5ca5.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
      `${F}/0,0,1500,1125,1500,1200/0-0-0/1c6bd652-96b4-4e7e-8941-e7d9152a5385/1/1/4+-+Gavin_Libotte_04+-+f31171ca-75f7-4754-b5cc-99cfcb92f4bc.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
      `${F}/0,0,1500,1125,1500,1200/0-0-0/9b4cbe46-c729-4475-a076-e5771347a5aa/1/1/5+-+Gavin_Libotte_05+-+f84374b5-aebe-4e4e-be19-1cb56a8fc892.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
      `${F}/0,0,1500,1125,1500,1200/0-0-0/f0bd3f13-343a-4f8a-8ac2-d877f94a529b/1/1/6+-+Gavin_Libotte_06+-+f6d545b5-71c9-442c-b4ef-09c293fa8b25.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
      `${F}/0,0,1500,1125,1500,1200/0-0-0/d2027885-4fc6-4db6-bf29-5e8a7c675e36/1/1/7+-+Gavin_Libotte_07+-+39c60526-b927-4ff6-a54f-b7a3f949d0b4.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
      `${F}/0,0,1500,1125,1500,1200/0-0-0/b3fdb197-dbdd-4795-86ea-253bd31aef6e/1/1/8+-+Gavin_Libotte_08+-+2ec2b7f7-6051-458c-a92a-c70cdf33e5a6.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
      `${F}/0,0,1500,1125,1500,1200/0-0-0/9f5484fa-d5b9-4fb5-8a48-9146deace42b/1/1/9+-+Gavin_Libotte_09+-+0565b8d2-de69-4ec4-8ff2-33e0b17f710e.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
      `${F}/0,0,1500,1125,1500,1200/0-0-0/e473f7c0-d63a-472c-ab72-f42456a3869a/1/1/10+-+Gavin_Libotte_10+-+cea45b6a-a2bf-4e3b-990b-18a74b9d7aa2.jpg?fjkss=exp=2096068167~hmac=2d344b454c325f4f11546c7394d1a7cd3f62122f793a71215d148cb1bb10a6d0`,
    ],
  },
  {
    id: "series.kevin-wolf-huzun",
    pagePath: "/huzun",
    photographer: "Kevin Wolf",
    seriesTitle: "HÜZÜN",
    workYear: 2023,
    statementText:
      "Kevin Wolf spent over two years returning to Istanbul, capturing the social contrasts in the everyday lives of its people. What he discovered was 'hüzün' – a feeling that Istanbul-born writer Orhan Pamuk once described as a 'collectively shared melancholy', a deep-rooted sense of loss and longing that has shaped the city's soul for centuries. It is an emotion closely linked to Istanbul's historical tensions – between East and West, political Islam and liberalism, tradition and modernity. The series HÜZÜN is Kevin Wolf's attempt to visualize this unique Istanbul feeling that drifts from the misty banks of the Bosphorus to the narrow alleys of the steep hillside neighborhoods in Türkiye's largest metropolis.",
    imageUrls: [
      `${F}/0,0,1500,1000,1500,1200/0-0-0/88605605-1c34-4e69-83e1-d91849b99354/1/1/1+-+HU%CC%88ZU%CC%88N_Original_+1+-+638586d1-0bff-4188-94a1-50b1712c1c56.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/75b569b9-7be0-478c-9110-56acd6fd35db/1/1/2+-+HU%CC%88ZU%CC%88N_Original_+2+-+ca1dd030-5490-4d7e-aebe-9143b96129b2.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/5a5eee87-1293-4a19-954b-9012b3025e8b/1/1/3+-+HU%CC%88ZU%CC%88N_Original_+17+-+3a736260-6402-48d3-a573-dff539d14acf.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/19e7f89d-33e2-4bd5-826b-e10acd224875/1/1/4+-+HU%CC%88ZU%CC%88N_Original_+3+-+e651c04e-ab5b-4b51-8745-c6fa750fe7a0.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/c2aac3f4-18e6-4d4e-961a-897608352cf5/1/1/5+-+HU%CC%88ZU%CC%88N_ORIGINAL_+10+-+ef43a3ef-3655-4818-9d6a-c70c32942010.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/d2151e12-12b8-482f-b8d1-bcf32cfff0bb/1/1/6+-+HU%CC%88ZU%CC%88N_Original_+12+-+9ec27e28-fa9b-4884-92c9-e2ba3e6af205.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/73f274a6-eedf-48e6-a183-68a15adc32ea/1/1/7+-+HU%CC%88ZU%CC%88N_Original_+9+-+7ae5e785-f442-4a23-ae7f-177eae6901a3.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/24e4eff6-c29a-451e-9f62-e9caeba25227/1/1/8+-+HU%CC%88ZU%CC%88N_Original_+24+-+3dac81f5-4f0a-4802-aa4f-fbd3f07bf2f6.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1001,1500,1200/0-0-0/377b88c0-af87-4131-800a-1deda96e95a6/1/1/9+-+HU%CC%88ZU%CC%88N_ORIGINAL_+18+-+5730c6ab-79bc-4ed6-aea6-13ccac6d5157.jpg?fjkss=exp=2096072395~hmac=f08863d19e28fe30cd5549dbeff488a61df1e21d2d42ebe5cb59b80b87f3bb85`,
      `${F}/0,0,1500,993,1500,1200/0-0-0/fed63c56-d4a1-4cb7-b384-754c29830e82/1/1/10+-+HU%CC%88ZU%CC%88N_Original_+26+-+dca8a66b-7b34-4cfa-9e53-164a08beebe3.jpg?fjkss=exp=2096072395~hmac=6a22b00c6776cc749c59f930576c5a224a547d1fa5ac64f5c3f04fcd2eb715df`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/a7a9dcbe-47cf-4b7c-8295-bed755b224da/1/1/11+-+HU%CC%88ZU%CC%88N_Original_+22+-+dac7b5c1-979b-4255-bee8-9590cceaec49.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,994,1500,1200/0-0-0/0df6310b-7742-4005-aadb-6a81c11065a2/1/1/12+-+HU%CC%88ZU%CC%88N_Original_+25+-+ec695a20-fab9-4bec-b1ea-bdfbb6b35288.jpg?fjkss=exp=2096072395~hmac=d422e7fd5be90f7e6eadc729a47fdc7591dc9588c46c23795262f3721965ddd5`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/3b4b6cc8-4231-4d12-88cd-9fbe76fbc35b/1/1/13+-+HU%CC%88ZU%CC%88N_Original_+19+-+5fb7d396-1534-4cd9-bfce-3b4bd42d7d17.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/ad7bc6fa-3165-4ee5-9b9e-004c62593501/1/1/14+-+HU%CC%88ZU%CC%88N_ORIGINAL_+29+-+c8d4ab7d-2931-4e37-894b-426e41b768ee.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/061c41e0-7bcc-4fc5-a960-c0366ea11a65/1/1/15+-+HU%CC%88ZU%CC%88N_Original_+5+-+dd3ad047-3de8-414d-b9c6-a6d86ac9e7d5.jpg?fjkss=exp=2096072395~hmac=4edb4f028bc4f4ca753adbfc1005dd8c34e39435b26715276b45784096cc22d9`,
    ],
  },
  {
    id: "series.skander-khlif-land-of-setting-sun",
    pagePath: "/land-of-setting-sun",
    photographer: "Skander Khlif",
    seriesTitle: "Land of the Setting Sun",
    workYear: 2022,
    award: "Series Winner",
    statementText:
      "Dakar was once the point where countless enslaved Africans were taken from their homeland — a history often overlooked but deeply present. Today, the city is in constant motion. From one day to the next, the landscape changes — new buildings rise, people move, and life pulses with unstoppable energy. This rapid transformation reflects more than urban growth; it reveals the heart of a continent reinventing itself through resilience and hope. Emerging from the shadows of its past, Dakar stands as a symbol of renewal — where memory and future coexist, and where magic lives in the spirit of its people and the ever-changing streets.",
    imageUrls: [
      `${F}/0,0,1500,1000,1500,1200/0-0-0/8199c11a-5034-4f18-aa7e-71d9f6a92bfa/1/1/1+-+skander+khlif+_1+-+d2cce36c-f229-41b1-bdd6-48a6d7351fe9.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/bd652d83-e33e-49c3-9835-a5b9e6e5ea71/1/1/2+-+skander+khlif+_2+-+d1427a9b-ab3b-4b18-88e1-19efd9beb311.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/6ac2e627-1886-4f78-a243-a66d94bbc02d/1/1/3+-+skander+khlif+_3+-+b142bdcb-e8f3-4a8f-a0ed-05c0a690999c.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/b96593d2-f8a6-43b4-adae-6ee178f54fb9/1/1/4+-+skander+khlif+_4+-+a2f6d737-39e9-4fb8-bde4-d2d999fab5af.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/b86a87b2-a406-44bb-8c6f-e5c53d02f4ed/1/1/5+-+skander+khlif+_5+-+8cc1868f-2725-4038-a1c4-f8e32cc32fc7.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/2192431b-24f6-417a-848f-21058495cbf3/1/1/6+-+skander+khlif+_6+-+04c648a6-dd3f-43d6-a0de-a84385db0c78.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/f1c44094-d756-488a-9b34-2d156129c566/1/1/7+-+skander+khlif+_7+-+6d2c4d00-1f6a-4500-b4f5-d9414de77370.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/228e8eb4-eb0a-4687-8fe2-82d78c74ff92/1/1/8+-+skander+khlif+_8+-+5048685b-67ea-44c5-a844-771b93d4b032.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/3ce1f57d-c212-4624-b196-dec89f8aec66/1/1/9+-+skander+khlif+_9+-+b847e245-8ede-4b1d-963a-a6e31d682695.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/ab9b1365-5d2c-4c68-8171-ccadc667122b/1/1/10+-+skander+khlif+_10+-+0d455875-b7c1-4368-b645-3cad3fcade8f.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/39738e5e-565f-493b-8704-af045a70a043/1/1/11+-+skander+khlif+_11+-+e93f0d77-79b8-4cbc-856a-2792a9043b79.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/f00386ff-b881-4efd-854d-f2deeaf74a86/1/1/12+-+skander+khlif+_12+-+4d0d102f-cc61-443c-8d3f-ffa08a107f41.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/646cff1b-81a0-4580-8cfd-41c18fcdf878/1/1/13+-+skander+khlif+_13+-+b9ce67f8-c47c-4077-bade-da9ef372472f.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,1000,1500,1200/0-0-0/694de5fe-c144-4d4e-b83a-b457aa8fd39b/1/1/14+-+skander+khlif+_14+-+b708cd4c-dbd5-434d-a231-c075fc559545.jpg?fjkss=exp=2096091014~hmac=e998574aee74ce7a3c23d2260b4a793c642bd8c61d1e59de7970d797e3570afe`,
      `${F}/0,0,1500,998,1500,1200/0-0-0/7c853865-8d6a-46f4-a7d2-79578f3eb2e0/1/1/15+-+skander+khlif+_15+-+a0fa53fe-aa1d-4a94-9bee-1405388cd8fe.jpg?fjkss=exp=2096091014~hmac=cfca4dd8c9286af7d041016ad66d3b07c71bb2e54f578267729f8789c29b88eb`,
    ],
  },
];

const exhibitions = [
  {
    id: "exhibition.singles-finalists-2025",
    pagePath: "/2025-exhibitions",
    title: "Singles Finalists Exhibition",
    slug: "singles-finalists-2025",
    venue: "Cisterna da FBAUL — University of Lisbon's Faculty of Fine Arts",
    openingDate: "2025-09-26",
    closingDate: "2025-09-28",
    coverUrl: `${F}/0,0,2048,1536,2048,1200/0-0-0/f1b57984-ae32-4184-9bc0-e303e6c3797a/1/1/martanferreira_LisbonStreetPhotoFest2025-17.jpg?fjkss=exp=2096063941~hmac=ad08a0662a738663924fd2b29f515cc15efc6ea0b4a6d098af8807a82688327c`,
    descriptionText:
      "The cistern hosted an immersive, atmospheric exhibition designed to emphasise the various modes of street photography showcased by our Open Call Singles finalists. Rather than a traditional hanging, this exhibition focused on ambience and visual flow, using the unique architectural characteristics of the cistern to create a more social encounter with the images. Presented with Colorfoto, curated by Narrativa, produced by LabKorner.",
    galleryUrls: [
      `${F}/0,0,3643,2429,3643,1200/0-0-0/24f9bf4d-ae65-4c16-93bf-83b445ad30ca/1/1/20250929_151229000_iOS.jpg?fjkss=exp=2096063941~hmac=d069ebcfa81cda19d0188e8a3792577b80bd4dde3b69f1f1734acfd998cb7d6a`,
      `${F}/0,0,3643,2429,3643,1200/0-0-0/5cd376a8-9597-49c1-ba81-36d6be36b640/1/1/20250925_154638060_iOS.jpg?fjkss=exp=2096063941~hmac=d069ebcfa81cda19d0188e8a3792577b80bd4dde3b69f1f1734acfd998cb7d6a`,
      `${F}/0,0,2545,1818,2545,1200/0-0-0/01cd6bc4-c340-4a7e-9554-5ea741662528/1/1/20250925_154919430_iOS.jpg?fjkss=exp=2096063941~hmac=fbd03e2619f099f24a8cb989d2f716cbe3dc5f1794540c243cfe97408a507ef6`,
    ],
  },
  {
    id: "exhibition.series-finalists-2025",
    pagePath: "/2025-exhibitions",
    title: "Series Finalists Gallery Exhibition",
    slug: "series-finalists-2025",
    venue: "FBAUL Gallery — University of Lisbon's Faculty of Fine Arts",
    openingDate: "2025-09-26",
    closingDate: "2025-09-28",
    coverUrl: `${F}/0,0,2051,1365,2051,1200/0-0-0/a7f89a2b-c37b-409d-a726-bef419ad50d6/1/1/L1033234.jpg?fjkss=exp=2096063941~hmac=6ce8250b4b2383afe16cff9b9b2dddd878c69c67e440f153e32e6099c9ac4fbb`,
    descriptionText:
      "The main gallery exhibition showcased the work of three finalists from the Open Call Series category. Each finalist presented a coherent set of images, allowing space for narrative, visual consistency, and individual authorship. The exhibition format encouraged close viewing and reflection, highlighting different approaches to contemporary street photography: from colour and form to social observation and atmosphere. Presented with Colorfoto, curated by Narrativa, framed by Arte de Arcos.",
    galleryUrls: [
      `${F}/0,0,3643,2429,3643,1200/0-0-0/c8b179a3-7006-479d-8930-d697faeba454/1/1/Skander3.jpg?fjkss=exp=2096063941~hmac=d069ebcfa81cda19d0188e8a3792577b80bd4dde3b69f1f1734acfd998cb7d6a`,
      `${F}/0,0,3643,2429,3643,1200/0-0-0/59cf91b5-877d-4562-938e-743004adb6c4/1/1/KWolf2.jpg?fjkss=exp=2096063941~hmac=d069ebcfa81cda19d0188e8a3792577b80bd4dde3b69f1f1734acfd998cb7d6a`,
      `${F}/0,0,3643,2429,3643,1200/0-0-0/23b964fa-a689-4e1f-acc6-63731b65689f/1/1/20250929_150623000_iOS.jpg?fjkss=exp=2096063941~hmac=d069ebcfa81cda19d0188e8a3792577b80bd4dde3b69f1f1734acfd998cb7d6a`,
      `${F}/0,0,828,1242,828,1200/0-0-0/6c73f739-3a0b-4f8d-8143-ac916b43e82c/1/1/NadiaCarreira.JPG?fjkss=exp=2096063941~hmac=27165c629c4c8a99088e90980275e48c1fe5749d703d4c21205da59acc9b5db4`,
    ],
  },
];

const aboutBody = [
  {
    _type: "block",
    _key: "ab1",
    style: "h2",
    children: [{ _type: "span", _key: "s1", text: "About the Festival", marks: [] }],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "ab2",
    style: "normal",
    children: [
      {
        _type: "span",
        _key: "s2",
        text:
          "Lisbon Street Photo Fest is organised by Associação 351 Foto, an independent non-profit based in Lisbon, Portugal. Focused on celebrating street photography, the festival offers exhibitions, talks, photowalks, portfolio reviews, and workshops, fostering creative exchange between photographers from around the world. The festival takes place at the Faculty of Fine Arts of the University of Lisbon.",
        marks: [],
      },
    ],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "ab3",
    style: "h2",
    children: [{ _type: "span", _key: "s3", text: "About the Team", marks: [] }],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "ab4",
    style: "normal",
    children: [
      {
        _type: "span",
        _key: "s4",
        text:
          "We're a diverse team of local & global photographers, creatives, and urban explorers based in Lisbon, who share a passion for street photography. It started as an idea between friends — something we felt was missing in the city. Now, we are growing it into a space for connection, discovery, and celebration of everyday life through images.",
        marks: [],
      },
    ],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "ab5",
    style: "h2",
    children: [{ _type: "span", _key: "s5", text: "Contact Us", marks: [] }],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "ab6",
    style: "normal",
    children: [
      {
        _type: "span",
        _key: "s6",
        text:
          "We keep growing, learning and improving, and would love to hear your thoughts! Do you have a question, an idea, or just want to say olá? Do you see a potential sponsorship or partnership opportunity? Email us at info@lisbonstreet.photo.",
        marks: [],
      },
    ],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "ab7",
    style: "h2",
    children: [
      { _type: "span", _key: "s7", text: "Our Commitment to a More Sustainable Festival", marks: [] },
    ],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "ab8",
    style: "normal",
    children: [
      {
        _type: "span",
        _key: "s8",
        text:
          "At Lisbon Street Photo Fest we believe that art and culture can flourish without compromising the planet that inspires us. We're taking important steps toward making our festival more sustainable. One concrete action in 2025 was the distribution of reusable water bottles to all attendees, preventing thousands of disposable bottles from entering the waste stream. We recognize that the largest share of emissions at cultural events usually comes from travel — we cannot yet eliminate this impact, but we are determined to reduce resource depletion and unnecessary waste wherever possible. We are using the Gallery Climate Coalition's framework and carbon calculator to measure our footprint over time.",
        marks: [],
      },
    ],
    markDefs: [],
  },
];

// ---------- main ----------
async function clean() {
  console.log("• Cleaning existing documents…");
  // Order matters: referencING docs first, referencED docs last.
  // siteSettings → edition; edition → workshops/exhibitions/finalists.
  const types = [
    "siteSettings",
    "page",
    "workshop",
    "finalistSingle",
    "finalistSeries",
    "exhibition",
    "edition",
  ];
  for (const t of types) {
    const docs = await client.fetch(`*[_type == "${t}"]{_id}`);
    if (docs.length === 0) continue;
    console.log(`  − ${t}: deleting ${docs.length}`);
    const tx = client.transaction();
    // Strip any draft prefixes too
    for (const d of docs) {
      tx.delete(d._id);
      tx.delete(`drafts.${d._id}`);
    }
    await tx.commit().catch(async (err) => {
      // Retry without the drafts to handle 404s on non-existent drafts
      const tx2 = client.transaction();
      for (const d of docs) tx2.delete(d._id);
      await tx2.commit();
    });
  }
}

/** Run an async function for each item with up to `concurrency` in flight. */
async function pMap(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

async function importAll() {
  if (CLEAN) await clean();

  const CONCURRENCY = 20; // Sanity inflight limit is 25; stay safely below

  // Resumable: skip a section if the expected number of docs already exist.
  const counts = await client.fetch(`{
    "editions": count(*[_type == "edition"]),
    "singles": count(*[_type == "finalistSingle"]),
    "series": count(*[_type == "finalistSeries"]),
    "exhibitions": count(*[_type == "exhibition"]),
    "people": count(*[_type == "person"]),
    "sponsors": count(*[_type == "sponsor"]),
    "page": count(*[_type == "page" && _id == "page.about"]),
    "site": count(*[_id == "siteSettings"])
  }`);
  console.log("• Current Sanity state:", counts);
  const skipEditions = counts.editions >= editions.length;
  const skipSingles = counts.singles >= singles.length;
  const skipSeries = counts.series >= series.length;
  const skipExhibitions = counts.exhibitions >= exhibitions.length;
  const skipPeople = counts.people >= people.length;
  const skipSponsors = counts.sponsors >= sponsors.length;

  // Pre-warm page cache only for sections we actually need.
  console.log("• Pre-fetching source pages…");
  const pages = new Set();
  if (!skipEditions) for (const ed of editions) pages.add(ed.pagePath);
  if (!skipSingles) pages.add(singlesPage);
  if (!skipSeries) for (const ser of series) pages.add(ser.pagePath);
  if (!skipExhibitions) for (const ex of exhibitions) pages.add(ex.pagePath);
  if (!skipPeople) pages.add(editionPage);
  if (!skipSponsors) {
    pages.add(editionPage);
    pages.add(singlesSponsorPage);
  }
  await Promise.all([...pages].map((p) => getPageHtml(p)));

  // Commit helper used per-section.
  async function commitDocs(label, docs) {
    if (docs.length === 0) return;
    const tx = client.transaction();
    for (const d of docs) tx.createOrReplace(d);
    await tx.commit();
    console.log(`  ✓ committed ${docs.length} ${label}`);
  }

  // Editions
  if (!skipEditions) {
    console.log("\n• Editions");
    const editionImgs = {};
    await pMap(editions, CONCURRENCY, async (ed) => {
      const url = await freshUrl(ed.heroUrl, ed.pagePath);
      editionImgs[ed._id] = await uploadImage(url, `${ed._id}-hero.jpg`);
    });
    await commitDocs(
      "editions",
      editions.map((ed) => ({
        _id: ed._id,
        _type: "edition",
        year: ed.year,
        slug: { _type: "slug", current: ed.slug },
        tagline: ed.tagline,
        startDate: ed.startDate,
        endDate: ed.endDate,
        heroImage: editionImgs[ed._id],
        intro: pt(ed.introText),
        ...(ed.openCallUrl ? { openCallUrl: ed.openCallUrl } : {}),
        ...(ed.openCallDeadline ? { openCallDeadline: ed.openCallDeadline } : {}),
      })),
    );
  } else console.log("• Editions: already imported, skipping");

  // Singles
  if (!skipSingles) {
    console.log("\n• Singles finalists");
    const singleDocs = await pMap(singles, CONCURRENCY, async (s) => {
      const url = await freshUrl(s.url, singlesPage);
      const img = await uploadImage(url, `${idSafe(s.id)}.jpg`);
      return {
        _id: idSafe(s.id),
        _type: "finalistSingle",
        photographer: s.photographer,
        slug: { _type: "slug", current: idSafe(s.id.replace(/^single\./, "")) },
        image: img,
        caption: s.title,
        year: 2025,
        ...(s.award ? { award: s.award } : {}),
      };
    });
    await commitDocs("singles", singleDocs);
  } else console.log("• Singles: already imported, skipping");

  // Series — commit per-series so we resume at series granularity.
  console.log("\n• Series finalists (per-series commit)");
  for (const ser of series) {
    const docId = idSafe(ser.id);
    const exists = await client.fetch(`*[_id == "${docId}"][0]._id`);
    if (exists) {
      console.log(`  skip ${ser.id} (already imported)`);
      continue;
    }
    console.log(`  ${ser.id} — ${ser.imageUrls.length} images`);
    const images = new Array(ser.imageUrls.length);
    await pMap(
      ser.imageUrls.map((url, i) => ({ url, i })),
      CONCURRENCY,
      async ({ url, i }) => {
        const fresh = await freshUrl(url, ser.pagePath);
        const u = await uploadImage(fresh, `${docId}.${i}.jpg`);
        images[i] = { ...u, _key: `img-${i}` };
      },
    );
    await commitDocs("series", [
      {
        _id: docId,
        _type: "finalistSeries",
        photographer: ser.photographer,
        seriesTitle: `${ser.seriesTitle}, ${ser.workYear}`,
        slug: { _type: "slug", current: idSafe(ser.id.replace(/^series\./, "")) },
        statement: pt(ser.statementText),
        images,
        year: 2025,
        ...(ser.award ? { award: ser.award } : {}),
      },
    ]);
  }

  // Exhibitions — per-exhibition commit
  console.log("\n• Exhibitions (per-exhibition commit)");
  for (const ex of exhibitions) {
    const docId = idSafe(ex.id);
    const exists = await client.fetch(`*[_id == "${docId}"][0]._id`);
    if (exists) {
      console.log(`  skip ${ex.id} (already imported)`);
      continue;
    }
    console.log(`  ${ex.id} — cover + ${ex.galleryUrls.length} gallery`);
    const coverFresh = await freshUrl(ex.coverUrl, ex.pagePath);
    const cover = await uploadImage(coverFresh, `${docId}-cover.jpg`);
    const gallery = new Array(ex.galleryUrls.length);
    await pMap(
      ex.galleryUrls.map((url, i) => ({ url, i })),
      CONCURRENCY,
      async ({ url, i }) => {
        const fresh = await freshUrl(url, ex.pagePath);
        const u = await uploadImage(fresh, `${docId}.${i}.jpg`);
        gallery[i] = { ...u, _key: `g-${i}` };
      },
    );
    await commitDocs("exhibitions", [
      {
        _id: docId,
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
      },
    ]);
  }

  // People — per-person commit.
  console.log("\n• People (per-person commit)");
  for (const p of people) {
    const docId = idSafe(p.id);
    const exists = await client.fetch(`*[_id == "${docId}"][0]._id`);
    if (exists) {
      console.log(`  skip ${p.name}`);
      continue;
    }
    const portraitUrl = await freshUrlByAssetId(p.assetId, [editionPage]);
    const portrait = await uploadImage(portraitUrl, `${docId}.jpg`);
    await commitDocs("people", [
      {
        _id: docId,
        _type: "person",
        name: p.name,
        slug: { _type: "slug", current: docId.replace(/^person\./, "") },
        ...(p.subtitle ? { subtitle: p.subtitle } : {}),
        ...(p.url ? { url: p.url } : {}),
        portrait,
        roles: p.roles,
        year: 2025,
      },
    ]);
  }

  // Sponsors — per-sponsor commit.
  console.log("\n• Sponsors (per-sponsor commit)");
  for (const s of sponsors) {
    const docId = idSafe(s.id);
    const exists = await client.fetch(`*[_id == "${docId}"][0]._id`);
    if (exists) {
      console.log(`  skip ${s.name}`);
      continue;
    }
    const logoUrl = await freshUrlByAssetId(s.assetId, [
      editionPage,
      singlesSponsorPage,
      "/open-call-series-2025",
      "/2025-exhibitions",
    ]);
    const logo = await uploadImage(logoUrl, `${docId}.png`);
    await commitDocs("sponsors", [
      {
        _id: docId,
        _type: "sponsor",
        name: s.name,
        slug: { _type: "slug", current: docId.replace(/^sponsor\./, "") },
        ...(s.tier ? { tier: s.tier } : {}),
        ...(s.url ? { url: s.url } : {}),
        logo,
        order: s.order,
        year: 2025,
      },
    ]);
  }

  // About + site settings — small, always re-commit (idempotent).
  console.log("\n• About page + site settings");
  await commitDocs("page", [
    {
      _id: "page.about",
      _type: "page",
      title: "About",
      slug: { _type: "slug", current: "about" },
      body: aboutBody,
    },
  ]);
  await commitDocs("siteSettings", [
    {
      _id: "siteSettings",
      _type: "siteSettings",
      siteName: "Lisbon Street Photo Fest",
      tagline: "Learning from the streets through photography.",
      currentEdition: { _type: "reference", _ref: "edition.2026" },
      nav: [
        { _key: "n1", label: "2026 Open Call", href: "https://site.picter.com/lisbon-street-photo-fest-2026" },
        { _key: "n2", label: "Activities", href: "/activities" },
        { _key: "n3", label: "2025 Edition", href: "/2025-edition" },
        { _key: "n4", label: "About", href: "/about" },
      ],
      instagram: "https://instagram.com/lisbonstreet.photo",
      contactEmail: "info@lisbonstreet.photo",
    },
  ]);

  console.log("\n✓ Import complete.");
  console.log(`  ${editions.length} editions`);
  console.log(`  ${singles.length} singles finalists`);
  console.log(`  ${series.length} series finalists`);
  console.log(`  ${exhibitions.length} exhibitions`);
  console.log("  1 about page, 1 site settings\n");
  console.log("Restart `npm run dev` and refresh http://localhost:4321/");
}

importAll().catch((err) => {
  console.error("\n✗ Import failed:", err);
  process.exit(1);
});
