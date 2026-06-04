import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool, defineDocuments, defineLocations } from "sanity/presentation";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemaTypes";

const SITE = "https://lspf-2026.pages.dev";
const LOCAL_PREVIEW_ORIGIN = "http://localhost:4321";

export default defineConfig({
  name: "default",
  title: "Lisbon Street Photo Fest",

  projectId: "nsxw1yrt",
  dataset: "production",

  plugins: [
    structureTool(),
    presentationTool({
      previewUrl: {
        origin:
          process.env.NODE_ENV === "development"
            ? LOCAL_PREVIEW_ORIGIN
            : SITE,
        preview: "/preview/",
      },
      resolve: {
        // Map document types to which preview URL renders them.
        // Most types are aggregated onto a section page, so all instances of
        // a type point to the same preview URL.
        mainDocuments: defineDocuments([
          {
            route: "/preview/",
            filter: '_type == "edition" && year >= 2026',
          },
          {
            route: "/preview/2025-edition",
            filter: '_type == "edition" && year == 2025',
          },
          {
            route: "/preview/2025-edition",
            filter: '_type == "person" || _type == "sponsor"',
          },
          {
            route: "/preview/2025-winners/singles",
            filter: '_type == "finalistSingle"',
          },
          {
            route: "/preview/2025-winners/series",
            filter: '_type == "finalistSeries"',
          },
          {
            route: "/preview/2025-winners/exhibitions",
            filter: '_type == "exhibition"',
          },
          {
            route: "/preview/about",
            filter: '_type == "page" && slug.current == "about"',
          },
        ]),
        locations: {
          edition: defineLocations({
            select: { year: "year", title: "tagline" },
            resolve: (doc) => ({
              locations: [
                {
                  title: `${doc?.year} Edition`,
                  href: doc?.year === 2025 ? "/preview/2025-edition" : "/preview/",
                },
              ],
            }),
          }),
          finalistSingle: defineLocations({
            select: { name: "photographer" },
            resolve: (doc) => ({
              locations: [{ title: `Singles · ${doc?.name}`, href: "/preview/2025-winners/singles" }],
            }),
          }),
          finalistSeries: defineLocations({
            select: { name: "photographer", title: "seriesTitle" },
            resolve: (doc) => ({
              locations: [{ title: `Series · ${doc?.title}`, href: "/preview/2025-winners/series" }],
            }),
          }),
          exhibition: defineLocations({
            select: { title: "title" },
            resolve: (doc) => ({
              locations: [{ title: `Exhibitions · ${doc?.title}`, href: "/preview/2025-winners/exhibitions" }],
            }),
          }),
          person: defineLocations({
            select: { name: "name" },
            resolve: (doc) => ({
              locations: [{ title: `2025 Edition · ${doc?.name}`, href: "/preview/2025-edition" }],
            }),
          }),
          sponsor: defineLocations({
            select: { name: "name" },
            resolve: (doc) => ({
              locations: [{ title: `Sponsors · ${doc?.name}`, href: "/preview/2025-edition" }],
            }),
          }),
          page: defineLocations({
            select: { title: "title", slug: "slug.current" },
            resolve: (doc) => ({
              locations: [{ title: doc?.title ?? "Page", href: `/preview/${doc?.slug}` }],
            }),
          }),
        },
      },
    }),
    visionTool(),
  ],

  schema: { types: schemaTypes },
});
