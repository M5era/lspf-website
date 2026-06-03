import type { Workshop } from "./types";

// Cover photos use real festival imagery (from the 2025 edition grid).
const FCDN = "https://format.creatorcdn.com/07d76fef-7923-45d8-af7f-d7f464fd7bac/0/0/0";

export const workshops: Workshop[] = [
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
    ticketTailorEventId: "REPLACE_WITH_TT_EVENT_ID",
    cover: {
      src: `${FCDN}/0,0,3643,2429,3643,1200/0-0-0/_DSF5618-asset/1/1/_DSF5618.jpg?fjkss=exp=2092902068~hmac=d2c74b5e10b23b1539166b5b135edf31db4afe21e4103f4dbaa90d8d48e7dc74`.replace(
        "_DSF5618-asset",
        "5bce35ba-0c0e-4872-b036-3903c9b9a99d",
      ),
      alt: "Street scene during Lisbon Street Photo Fest 2025",
    },
    description:
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
    ticketTailorEventId: "REPLACE_WITH_TT_EVENT_ID",
    cover: {
      src: `${FCDN}/0,0,3646,2427,1600,1200/0-0-0/d0fcb2ef-5d38-4e4c-ab59-ddf1704c6167/1/1/25-09-27+LSPF+-+Efi+Longinou+Photowalk+EN-3.jpg?fjkss=exp=2092902068~hmac=a2d4cec22610a619ef45acfba742c7619d19b1f76dd3d6a09a82388997533297`,
      alt: "Photowalk through Lisbon streets",
    },
    description:
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
    ticketTailorEventId: "REPLACE_WITH_TT_EVENT_ID",
    cover: {
      src: `${FCDN}/0,0,3646,2427,1600,1200/0-0-0/4693e3dc-a630-46ee-8e06-fd2f750acb91/1/1/25-09-27+LSPF+-+Ana+Paganini+Talk+EN-17.jpg?fjkss=exp=2092902068~hmac=a2d4cec22610a619ef45acfba742c7619d19b1f76dd3d6a09a82388997533297`,
      alt: "Talk during Lisbon Street Photo Fest 2025",
    },
    description:
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
    ticketTailorEventId: "REPLACE_WITH_TT_EVENT_ID",
    cover: {
      src: `${FCDN}/0,0,3643,2429,1600,1200/0-0-0/0a2ffad6-3396-4869-9552-3617ec0a725f/1/1/_DSF5332.jpg?fjkss=exp=2092902068~hmac=d2c74b5e10b23b1539166b5b135edf31db4afe21e4103f4dbaa90d8d48e7dc74`,
      alt: "Portfolio review session",
    },
    description:
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
    ticketTailorEventId: "REPLACE_WITH_TT_EVENT_ID",
    cover: {
      src: `${FCDN}/0,0,3434,2289,1600,1200/0-0-0/236f6707-7096-482c-835b-e6ac8547b335/1/1/20250927_194239040_iOS.jpg?fjkss=exp=2092902068~hmac=bbe5a618d948a16a4c6555c3cd05cd7c5edec446b0c139181517dc1bbed66021`,
      alt: "Zine workshop during the festival",
    },
    description:
      "Walk in with a folder of images, walk out with a printed and stitched zine. Materials included.",
  },
];
