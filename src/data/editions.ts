import type { Edition } from "./types";

// Real images from the original Format CDN. Signed URLs valid until ~2095.
// Used as fallbacks; when Sanity is wired (`USE_SANITY=true`), CMS values win.

export const editions: Edition[] = [
  {
    year: 2026,
    slug: "2026",
    tagline: "Rooted in Lisbon. Open to the world.",
    startDate: "2026-09-25",
    endDate: "2026-09-27",
    heroImage: {
      src: "https://format.creatorcdn.com/07d76fef-7923-45d8-af7f-d7f464fd7bac/0/0/0/0,0,1723,1291,1600,1291/0-0-0/b0074639-2efa-4565-bfba-494d5723da6b/1/1/kites.jpg?fjkss=exp=2095985173~hmac=3592adb334ae3d8396ee8a1273d033d318f36239e64570370263c6bf37795753",
      alt: "Kites flying over a Lisbon waterfront — Lisbon Street Photo Fest",
      width: 1723,
      height: 1291,
    },
    intro:
      "From 25–27 September 2026, we'll meet in Lisbon for the second edition of Lisbon Street Photo Fest: a celebration of street photography, bringing together photographers, enthusiasts, and curious minds from around the world.",
    openCallUrl: "https://site.picter.com/lisbon-street-photo-fest-2026",
    openCallDeadline: "2026-05-31",
  },
  {
    year: 2025,
    slug: "2025",
    tagline: "The first edition.",
    startDate: "2025-09-26",
    endDate: "2025-09-28",
    heroImage: {
      src: "https://format.creatorcdn.com/07d76fef-7923-45d8-af7f-d7f464fd7bac/0/0/0/0,0,1200,798,1600,798/0-0-0/d34013d8-1929-4b18-aabc-2e9724eb63d3/1/1/auditorium-audience.jpg?fjkss=exp=2095985173~hmac=f3b812fa36dc7fc35de866d5d98ddf33180bb8c87dae10361c065736f01877b9",
      alt: "Auditorium audience at Lisbon Street Photo Fest 2025",
      width: 1200,
      height: 798,
    },
    intro:
      "The inaugural Lisbon Street Photo Fest brought together hundreds of photographers across three days of exhibitions, talks, workshops and photowalks at Faculdade de Belas-Artes.",
  },
];

export const currentEdition = editions[0];
