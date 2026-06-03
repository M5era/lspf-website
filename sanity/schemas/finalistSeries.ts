import { defineField, defineType } from "sanity";

export default defineType({
  name: "finalistSeries",
  title: "Finalist — Series",
  type: "document",
  fields: [
    defineField({
      name: "photographer",
      title: "Photographer name",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "seriesTitle",
      title: "Series title",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "seriesTitle" },
    }),
    defineField({
      name: "country",
      title: "Country",
      type: "string",
    }),
    defineField({
      name: "statement",
      title: "Artist statement",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            { name: "caption", type: "string", title: "Caption" },
          ],
        },
      ],
      validation: (r) => r.min(2).max(20),
    }),
    defineField({
      name: "year",
      title: "Edition year",
      type: "number",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "award",
      title: "Award",
      type: "string",
    }),
  ],
});
