import { defineField, defineType } from "sanity";

export default defineType({
  name: "edition",
  title: "Festival Edition",
  type: "document",
  fields: [
    defineField({
      name: "year",
      title: "Year",
      type: "number",
      validation: (r) => r.required().min(2024).max(2100),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "year" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "tagline",
      title: "Tagline",
      type: "string",
      description: 'e.g. "Rooted in Lisbon. Open to the world."',
    }),
    defineField({
      name: "startDate",
      title: "Start date",
      type: "date",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "endDate",
      title: "End date",
      type: "date",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "heroImage",
      title: "Hero image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "intro",
      title: "Intro (long text)",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "openCallUrl",
      title: "Open Call URL (Picter)",
      type: "url",
    }),
    defineField({
      name: "openCallDeadline",
      title: "Open Call deadline",
      type: "date",
    }),
  ],
});
