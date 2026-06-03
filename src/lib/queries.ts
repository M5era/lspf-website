// GROQ queries — projected to match the TypeScript shapes in src/data/types.ts
// so swapping a placeholder array for a live query requires no template changes.

export const siteSettingsQuery = /* groq */ `
*[_type == "siteSettings"][0]{
  siteName,
  tagline,
  "currentEditionYear": currentEdition->year,
  nav,
  instagram,
  contactEmail
}
`;

export const pageBySlugQuery = /* groq */ `
*[_type == "page" && slug.current == $slug][0]{
  title,
  "slug": slug.current,
  body
}
`;

export const peopleByYearAndRoleQuery = /* groq */ `
*[_type == "person" && year == $year && $role in roles] | order(name asc){
  "slug": slug.current,
  name,
  subtitle,
  url,
  roles,
  year,
  "portrait": {
    "src": portrait.asset->url,
    "alt": coalesce(portrait.alt, name)
  }
}
`;

export const sponsorsByYearQuery = /* groq */ `
*[_type == "sponsor" && year == $year] | order(coalesce(order, 99) asc, name asc){
  "slug": slug.current,
  name,
  tier,
  url,
  year,
  order,
  "logo": {
    "src": logo.asset->url,
    "alt": coalesce(logo.alt, name)
  }
}
`;

export const currentEditionQuery = /* groq */ `
*[_type == "edition"] | order(year desc)[0]{
  year,
  "slug": slug.current,
  tagline,
  startDate,
  endDate,
  "heroImage": {
    "src": heroImage.asset->url,
    "alt": coalesce(heroImage.alt, tagline),
    "width": heroImage.asset->metadata.dimensions.width,
    "height": heroImage.asset->metadata.dimensions.height
  },
  "intro": pt::text(intro),
  openCallUrl,
  openCallDeadline
}
`;

export const allEditionsQuery = /* groq */ `
*[_type == "edition"] | order(year desc){
  year,
  "slug": slug.current,
  tagline,
  startDate,
  endDate,
  "heroImage": {
    "src": heroImage.asset->url,
    "alt": coalesce(heroImage.alt, tagline)
  },
  "intro": pt::text(intro)
}
`;

export const allWorkshopsQuery = /* groq */ `
*[_type == "workshop"] | order(startsAt asc){
  "slug": slug.current,
  title,
  kind,
  instructor,
  startsAt,
  endsAt,
  location,
  priceEUR,
  capacity,
  ticketTailorEventId,
  "cover": {
    "src": cover.asset->url,
    "alt": coalesce(cover.alt, title)
  },
  "description": pt::text(description)
}
`;

export const finalistsSinglesByYearQuery = /* groq */ `
*[_type == "finalistSingle" && year == $year]{
  "slug": slug.current,
  photographer,
  country,
  "image": {
    "src": image.asset->url,
    "alt": coalesce(image.alt, photographer)
  },
  caption,
  year,
  award
}
`;

export const finalistsSeriesByYearQuery = /* groq */ `
*[_type == "finalistSeries" && year == $year]{
  "slug": slug.current,
  photographer,
  seriesTitle,
  country,
  "statement": pt::text(statement),
  "images": images[]{
    "src": asset->url,
    "alt": coalesce(caption, ^.photographer)
  },
  year,
  award
}
`;

export const exhibitionsByYearQuery = /* groq */ `
*[_type == "exhibition" && year == $year]{
  "slug": slug.current,
  title,
  year,
  venue,
  openingDate,
  closingDate,
  "cover": {
    "src": cover.asset->url,
    "alt": coalesce(cover.alt, title)
  },
  "description": pt::text(description),
  "gallery": gallery[]{
    "src": asset->url,
    "alt": coalesce(alt, ^.title)
  }
}
`;
