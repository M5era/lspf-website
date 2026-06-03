import type { Exhibition } from "./types";

const FCDN = "https://format.creatorcdn.com/07d76fef-7923-45d8-af7f-d7f464fd7bac/0/0/0";

export const exhibitions2025: Exhibition[] = [
  {
    slug: "open-call-2025",
    title: "Open Call 2025: Finalists",
    year: 2025,
    venue: "Faculdade de Belas-Artes, Sala de Exposições",
    openingDate: "2025-09-26",
    closingDate: "2025-10-12",
    cover: {
      src: `${FCDN}/0,0,3643,2429,3643,1200/0-0-0/b261407c-6c20-4f80-a59d-84ea37117900/1/1/20250928_134708800_iOS.jpg?fjkss=exp=2092902068~hmac=d2c74b5e10b23b1539166b5b135edf31db4afe21e4103f4dbaa90d8d48e7dc74`,
      alt: "Open Call 2025 exhibition wall",
    },
    description:
      "The full collection of selected finalist works from the 2025 Open Call, hung salon-style across the main exhibition hall.",
    gallery: [
      {
        src: `${FCDN}/0,0,3643,2429,3643,1200/0-0-0/ce8b4693-bda9-4ce9-827d-eeca58a6e9c2/1/1/_DSC9784.JPG?fjkss=exp=2092902068~hmac=d2c74b5e10b23b1539166b5b135edf31db4afe21e4103f4dbaa90d8d48e7dc74`,
        alt: "Exhibition installation view",
      },
      {
        src: `${FCDN}/0,0,3643,2429,3643,1200/0-0-0/df8bb669-25af-42ce-bd3c-d5de87753d32/1/1/20250927_174806370_iOS.jpg?fjkss=exp=2092902068~hmac=d2c74b5e10b23b1539166b5b135edf31db4afe21e4103f4dbaa90d8d48e7dc74`,
        alt: "Visitors in the exhibition hall",
      },
      {
        src: `${FCDN}/0,0,1365,2048,1365,1200/0-0-0/c9155b38-deec-4b2a-b651-e9503a906921/1/1/PHOTO-2025-09-28-15-35-25+2.jpg?fjkss=exp=2092902068~hmac=63accab2c5f241de76c0422ed3e04e852fb5a685ccb8b08ca83bb0231949fc2d`,
        alt: "Visitor in front of a finalist print",
      },
    ],
  },
  {
    slug: "tagus-light",
    title: "Tagus Light: A Retrospective",
    year: 2025,
    venue: "Galeria Quadrum",
    openingDate: "2025-09-25",
    closingDate: "2025-10-25",
    cover: {
      src: `${FCDN}/0,0,3643,2429,3643,1200/0-0-0/0d92c31e-b2c8-445e-9b51-2e22518f846f/1/1/20250928_183646760_iOS.jpg?fjkss=exp=2092902069~hmac=ce26c928fc26da7e853b455b8a7d694e4f8248716f3c82b94273346780910483`,
      alt: "Tagus Light exhibition",
    },
    description:
      "Thirty years of Lisbon photography from the archives of three Portuguese street photographers.",
    gallery: [
      {
        src: `${FCDN}/0,0,3643,2429,3643,1200/0-0-0/0a2ffad6-3396-4869-9552-3617ec0a725f/1/1/_DSF5332.jpg?fjkss=exp=2092902068~hmac=d2c74b5e10b23b1539166b5b135edf31db4afe21e4103f4dbaa90d8d48e7dc74`,
        alt: "Tagus Light gallery view",
      },
      {
        src: `${FCDN}/0,0,3643,2429,3643,1200/0-0-0/b26626d9-5bc7-4c0e-a4f6-569479afbfba/1/1/_DSF5327.jpg?fjkss=exp=2092902068~hmac=d2c74b5e10b23b1539166b5b135edf31db4afe21e4103f4dbaa90d8d48e7dc74`,
        alt: "Tagus Light close up",
      },
    ],
  },
];
