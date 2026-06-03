// These types mirror the Sanity schemas in /sanity/schemas.
// When you wire up Sanity, replace these placeholder imports with GROQ queries
// that return the same shape.

export type ImageRef = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type Workshop = {
  slug: string;
  title: string;
  kind: "workshop" | "photowalk" | "talk" | "portfolio-review";
  instructor?: string;
  startsAt: string; // ISO
  endsAt?: string;
  location?: string;
  priceEUR: number; // 0 = free
  capacity?: number;
  ticketTailorEventId?: string;
  cover: ImageRef;
  description: string;
};

export type FinalistSingle = {
  slug: string;
  photographer: string;
  country?: string;
  image: ImageRef;
  caption?: string;
  year: number;
  award?: string;
};

export type FinalistSeries = {
  slug: string;
  photographer: string;
  seriesTitle: string;
  country?: string;
  statement?: string;
  images: ImageRef[];
  year: number;
  award?: string;
};

export type Exhibition = {
  slug: string;
  title: string;
  year: number;
  venue?: string;
  openingDate?: string;
  closingDate?: string;
  cover: ImageRef;
  description: string;
  gallery?: ImageRef[];
};

export type Edition = {
  year: number;
  slug: string;
  tagline: string;
  startDate: string;
  endDate: string;
  heroImage: ImageRef;
  intro: string;
  openCallUrl?: string;
  openCallDeadline?: string;
};

export type NavItem = {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
};

export type SiteSettings = {
  siteName: string;
  tagline: string;
  currentEditionYear: number;
  nav: NavItem[];
  instagram: string;
  contactEmail: string;
};

export type Person = {
  slug: string;
  name: string;
  subtitle?: string;
  url?: string;
  portrait?: ImageRef;
  roles: (
    | "headliner"
    | "workshop"
    | "portfolio-review"
    | "photowalk"
    | "spotlight-talk"
    | "jury"
    | "team"
  )[];
  year: number;
};

export type Sponsor = {
  slug: string;
  name: string;
  logo?: ImageRef;
  url?: string;
  tier?: string;
  order?: number;
  year: number;
};
