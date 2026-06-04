import { defineField, defineType } from "sanity";

export default defineType({
  name: "workshop",
  title: "Workshop / Photowalk / Talk",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "kind",
      title: "Kind",
      type: "string",
      options: {
        list: [
          { title: "Workshop", value: "workshop" },
          { title: "Photowalk", value: "photowalk" },
          { title: "Talk", value: "talk" },
          { title: "Portfolio review", value: "portfolio-review" },
        ],
        layout: "radio",
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "instructor",
      title: "Instructor",
      type: "string",
    }),
    defineField({
      name: "startsAt",
      title: "Starts at",
      type: "datetime",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "endsAt",
      title: "Ends at",
      type: "datetime",
    }),
    defineField({
      name: "location",
      title: "Location",
      type: "string",
    }),
    defineField({
      name: "priceEUR",
      title: "Price (EUR)",
      type: "number",
      description: "0 for free events",
    }),
    defineField({
      name: "capacity",
      title: "Capacity",
      type: "number",
    }),
    defineField({
      name: "ticketTailorEventId",
      title: "Ticket Tailor event link",
      type: "string",
      description:
        "The Ticket Tailor event link or event ID. The site opens the ticket checkout page using this value.",
    }),
    defineField({
      name: "cover",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "array",
      of: [{ type: "block" }],
    }),
  ],
});
