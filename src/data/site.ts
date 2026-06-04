import type { SiteSettings } from "./types";

export const site: SiteSettings = {
  siteName: "Lisbon Street Photo Fest",
  tagline: "Learning from the streets through photography.",
  currentEditionYear: 2026,
  nav: [
    { label: "2026 Open Call", href: "https://site.picter.com/lisbon-street-photo-fest-2026" },
    { label: "Activities", href: "/activities" },
    {
      label: "Past Editions",
      children: [
        { label: "2025 Edition", href: "/2025-edition" },
      ],
    },
    { label: "About", href: "/about" },
  ],
  instagram: "https://instagram.com/lisbonstreet.photo",
  contactEmail: "hello@lisbonstreet.photo",
};
