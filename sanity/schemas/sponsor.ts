import { defineField, defineType } from "sanity";

export default defineType({
  name: "sponsor",
  title: "Sponsor",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name" },
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "url",
      title: "Website URL",
      type: "url",
    }),
    defineField({
      name: "tier",
      title: "Tier / role",
      type: "string",
      description:
        'e.g. "Presenter", "Curation", "Frames", "Awards" — appears as label above the logo.',
    }),
    defineField({
      name: "year",
      title: "Edition year",
      type: "number",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "order",
      title: "Display order",
      type: "number",
      description: "Lower numbers appear first.",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "tier", media: "logo" },
  },
});
