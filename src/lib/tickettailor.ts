/**
 * Minimal Ticket Tailor client. We pull just the fields we need to render
 * a workshop card: name, start/end, description, cover image, capacity.
 *
 * Server-side only — uses TICKETTAILOR_API_KEY from env. Never reaches
 * the browser.
 */

const KEY = import.meta.env.TICKETTAILOR_API_KEY;

export type TtEvent = {
  id: string;
  name: string;
  description?: string; // HTML
  start?: { iso?: string };
  end?: { iso?: string };
  currency?: string;
  status?: "draft" | "published";
  images?: { header?: string; thumbnail?: string };
  total_issued?: number | null;
  total_available?: number | null;
  checkout_url?: string;
};

const TT_CACHE = new Map<string, TtEvent | null>();

/** Extract a usable event ID from a raw value: "8430487", "ev_8430487",
 *  "2249139", "es_2249139", or a full URL like
 *  "https://buytickets.at/lisbonstreetphotofest/2249139". */
function normalizeId(idLike: string): string {
  if (!idLike) return idLike;
  const stripped = idLike.trim().replace(/\/$/, "");
  const tail = stripped.split("/").pop() ?? stripped;
  // If it's already prefixed (ev_/es_), use as-is
  if (/^(ev|es)_\d+$/.test(tail)) return tail;
  // Pure numeric → assume event id and prefix with ev_
  if (/^\d+$/.test(tail)) return `ev_${tail}`;
  return tail;
}

/** Strip HTML tags + entities to plain text, single-line. */
function htmlToText(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export async function getTtEvent(idLike: string): Promise<TtEvent | null> {
  if (!KEY) {
    console.warn("[tt] TICKETTAILOR_API_KEY missing — skipping TT enrichment");
    return null;
  }
  const id = normalizeId(idLike);
  if (TT_CACHE.has(id)) return TT_CACHE.get(id)!;

  const auth = btoa(`${KEY}:`); // Workers-compatible (no Node Buffer)
  const numeric = id.replace(/^(ev_|es_)/, "");

  // The public URL uses the event-series id (2249139). The Sanity field may
  // hold either: a series id (es_…), an event id (ev_…), or a bare number.
  // Try the most likely candidates in order: provided form first, then the
  // alternate prefix, then the series-listing endpoint.
  const candidates: string[] = [
    `https://api.tickettailor.com/v1/events/${id}`,
    `https://api.tickettailor.com/v1/events/ev_${numeric}`,
    `https://api.tickettailor.com/v1/event_series/es_${numeric}/events?limit=1`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as TtEvent | { data: TtEvent[] };
      const event: TtEvent | null = "data" in json ? (json.data?.[0] ?? null) : json;
      if (event && event.id) {
        TT_CACHE.set(id, event);
        return event;
      }
    } catch (err) {
      console.warn(`[tt] fetch ${url} failed`, err);
    }
  }
  console.warn(`[tt] event ${idLike} (${id}) not found via any endpoint`);
  TT_CACHE.set(id, null);
  return null;
}

/** Map a TT event into the partial Workshop fields it can fill. */
export function ttToWorkshopFields(ev: TtEvent) {
  return {
    title: ev.name,
    startsAt: ev.start?.iso,
    endsAt: ev.end?.iso,
    description: htmlToText(ev.description),
    capacity:
      typeof ev.total_issued === "number"
        ? ev.total_issued
        : typeof ev.total_available === "number"
          ? ev.total_available
          : undefined,
    coverFromTt: ev.images?.header,
  };
}
