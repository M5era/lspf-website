// Data loaders. Each function tries Sanity first (when USE_SANITY=true and
// content exists), otherwise returns the placeholder data from src/data/.
//
// This pattern lets you build the site against placeholders, populate Sanity
// gradually, and flip USE_SANITY=true when ready — without changing pages.

import { sanityClient, sanityPreviewClient, useSanity } from "./sanity";
import {
  allWorkshopsQuery,
  currentEditionQuery,
  allEditionsQuery,
  finalistsSinglesByYearQuery,
  finalistsSeriesByYearQuery,
  exhibitionsByYearQuery,
  pageBySlugQuery,
  peopleByYearAndRoleQuery,
  sponsorsByYearQuery,
} from "./queries";

import type {
  Edition,
  Workshop,
  FinalistSingle,
  FinalistSeries,
  Exhibition,
  Person,
  Sponsor,
} from "@/data/types";

// Placeholder fallbacks
import { editions as placeholderEditions, currentEdition as placeholderCurrent } from "@/data/editions";
import { workshops as placeholderWorkshops } from "@/data/workshops";
import { singles2025 as placeholderSingles, series2025 as placeholderSeries } from "@/data/finalists";
import { exhibitions2025 as placeholderExhibitions } from "@/data/exhibitions";

type Opts = { preview?: boolean };

async function trySanity<T>(
  label: string,
  query: string,
  params: Record<string, unknown> = {},
  opts: Opts = {},
): Promise<T | null> {
  if (!useSanity) {
    console.log(`[loaders] ${label}: USE_SANITY=false → placeholder`);
    return null;
  }
  const client = opts.preview ? sanityPreviewClient : sanityClient;
  try {
    const result = await client.fetch<T>(query, params);
    if (result == null) {
      console.log(`[loaders] ${label}: Sanity returned null → placeholder`);
      return null;
    }
    if (Array.isArray(result) && result.length === 0) {
      console.log(`[loaders] ${label}: Sanity returned empty array → placeholder`);
      return null;
    }
    const count = Array.isArray(result) ? result.length : 1;
    console.log(`[loaders] ${label}: Sanity returned ${count} doc(s) ✓`);
    return result;
  } catch (err) {
    console.warn(
      `[loaders] ${label}: Sanity fetch failed → placeholder`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function getCurrentEdition(opts: Opts = {}): Promise<Edition> {
  const live = await trySanity<Edition>("currentEdition", currentEditionQuery, {}, opts);
  return live ?? placeholderCurrent;
}

export async function getAllEditions(opts: Opts = {}): Promise<Edition[]> {
  const live = await trySanity<Edition[]>("allEditions", allEditionsQuery, {}, opts);
  return live ?? placeholderEditions;
}

export async function getWorkshops(opts: Opts = {}): Promise<Workshop[]> {
  if (!useSanity) return placeholderWorkshops;
  const client = opts.preview ? sanityPreviewClient : sanityClient;
  try {
    return (await client.fetch<Workshop[]>(allWorkshopsQuery)) ?? [];
  } catch (err) {
    console.warn("[loaders] workshops: Sanity fetch failed, using placeholder", err);
    return placeholderWorkshops;
  }
}

export async function getFinalistSingles(year: number, opts: Opts = {}): Promise<FinalistSingle[]> {
  const live = await trySanity<FinalistSingle[]>(
    `finalistSingles(${year})`,
    finalistsSinglesByYearQuery,
    { year },
    opts,
  );
  return live ?? (year === 2025 ? placeholderSingles : []);
}

export async function getFinalistSeries(year: number, opts: Opts = {}): Promise<FinalistSeries[]> {
  const live = await trySanity<FinalistSeries[]>(
    `finalistSeries(${year})`,
    finalistsSeriesByYearQuery,
    { year },
    opts,
  );
  return live ?? (year === 2025 ? placeholderSeries : []);
}

export async function getExhibitions(year: number, opts: Opts = {}): Promise<Exhibition[]> {
  const live = await trySanity<Exhibition[]>(
    `exhibitions(${year})`,
    exhibitionsByYearQuery,
    { year },
    opts,
  );
  return live ?? (year === 2025 ? placeholderExhibitions : []);
}

/** Portable Text blocks from a Sanity `page` document. */
export type PageDoc = {
  title: string;
  slug: string;
  body: Array<{
    _type: "block";
    style?: string;
    children?: Array<{ _type: "span"; text: string; marks?: string[] }>;
  }>;
};

export async function getPage(slug: string, opts: Opts = {}): Promise<PageDoc | null> {
  return await trySanity<PageDoc>(`page(${slug})`, pageBySlugQuery, { slug }, opts);
}

export async function getPeople(
  year: number,
  role: Person["roles"][number],
  opts: Opts = {},
): Promise<Person[]> {
  const live = await trySanity<Person[]>(
    `people(${year},${role})`,
    peopleByYearAndRoleQuery,
    { year, role },
    opts,
  );
  return live ?? [];
}

export async function getSponsors(year: number, opts: Opts = {}): Promise<Sponsor[]> {
  const live = await trySanity<Sponsor[]>(
    `sponsors(${year})`,
    sponsorsByYearQuery,
    { year },
    opts,
  );
  return live ?? [];
}
