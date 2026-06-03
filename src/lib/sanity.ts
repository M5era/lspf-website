import { createClient, type SanityClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";

const projectId =
  import.meta.env.PUBLIC_SANITY_PROJECT_ID ?? "nsxw1yrt";
const dataset = import.meta.env.PUBLIC_SANITY_DATASET ?? "production";
// Use the Sanity CDN only in production builds.
// In dev, hit the live API so edits in Studio appear on the next page refresh.
const useCdn =
  import.meta.env.PROD &&
  import.meta.env.PUBLIC_SANITY_USE_CDN !== "false";

// Server-side only (no PUBLIC_ prefix) — never reaches the browser.
const token = import.meta.env.SANITY_READ_TOKEN ?? import.meta.env.SANITY_AUTH_TOKEN;

export const sanityClient: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: "2025-01-01",
  useCdn,
  token,
  perspective: "published",
});

/**
 * Preview client — fetches draft + published documents.
 * Used by /preview/* SSR routes so editors can see unpublished changes.
 * Always bypasses CDN to ensure freshness.
 */
export const sanityPreviewClient: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: "2025-01-01",
  useCdn: false,
  token,
  perspective: "previewDrafts",
});

const builder = imageUrlBuilder(sanityClient);

/** Build an optimized image URL from a Sanity image reference. */
export function urlFor(source: unknown) {
  return builder.image(source as any);
}

/** Helper to detect whether to fetch from Sanity or fall back to placeholders. */
export const useSanity =
  import.meta.env.USE_SANITY === "true";
