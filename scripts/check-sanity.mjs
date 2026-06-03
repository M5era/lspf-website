#!/usr/bin/env node
/**
 * Diagnostic: query Sanity directly and print what's there.
 * Run: npm run check
 */
import { createClient } from "@sanity/client";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

const client = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID ?? "nsxw1yrt",
  dataset: process.env.PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2025-01-01",
  useCdn: false, // bypass cache so we see fresh state
  token: process.env.SANITY_AUTH_TOKEN, // optional; allows reading drafts
});

const counts = await client.fetch(`{
  "siteSettings": count(*[_type == "siteSettings"]),
  "editions": count(*[_type == "edition"]),
  "workshops": count(*[_type == "workshop"]),
  "finalistSingles": count(*[_type == "finalistSingle"]),
  "finalistSeries": count(*[_type == "finalistSeries"]),
  "exhibitions": count(*[_type == "exhibition"])
}`);

console.log("\nPublished documents in Sanity (project nsxw1yrt, dataset production):");
console.log(counts);

const edition2026 = await client.fetch(
  `*[_type == "edition" && year == 2026][0]{ year, tagline, startDate, endDate, "intro": pt::text(intro) }`,
);

console.log("\n2026 edition (published version):");
console.log(edition2026 ?? "  (none — only a draft exists, or not seeded)");

console.log(
  "\nIf the counts above show docs but the site shows placeholders, USE_SANITY in .env might be false.",
);
console.log("If 2026 edition shows the old tagline, you saved a draft but didn't Publish.\n");
