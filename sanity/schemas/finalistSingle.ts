import { defineField, defineType } from "sanity";

export default defineType({
  name: "finalistSingle",
  title: "Finalist — Single Image",
  type: "document",
  fields: [
    defineField({
      name: "photographer",
      title: "Photographer name",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "photographer" },
    }),
    defineField({
      name: "country",
      title: "Country",
      type: "string",
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "text",
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
      description: 'e.g. "Winner", "Honourable mention"',
    }),
  ],
});
