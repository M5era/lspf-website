import { defineField, defineType } from "sanity";

export default defineType({
  name: "person",
  title: "Person",
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
      validation: (r) => r.required(),
    }),
    defineField({
      name: "portrait",
      title: "Portrait",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "subtitle",
      title: "Subtitle / affiliation",
      type: "string",
      description: 'e.g. "Magnum Photos", "Framelines Magazine"',
    }),
    defineField({
      name: "url",
      title: "Website / Instagram URL",
      type: "url",
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "roles",
      title: "Roles at the festival",
      description: "Where this person should appear (one or more roles).",
      type: "array",
      of: [
        {
          type: "string",
          options: {
            list: [
              { title: "Headliner", value: "headliner" },
              { title: "Workshop instructor", value: "workshop" },
              { title: "Portfolio reviewer", value: "portfolio-review" },
              { title: "Photowalk leader", value: "photowalk" },
              { title: "Spotlight talk", value: "spotlight-talk" },
              { title: "Open Call jury", value: "jury" },
              { title: "Team member", value: "team" },
            ],
          },
        },
      ],
      validation: (r) => r.unique(),
    }),
    defineField({
      name: "year",
      title: "Edition year",
      type: "number",
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "subtitle", media: "portrait" },
  },
});
