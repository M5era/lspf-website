import { defineField, defineType } from "sanity";

export default defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({
      name: "siteName",
      title: "Site name",
      type: "string",
    }),
    defineField({
      name: "tagline",
      title: "Tagline",
      type: "string",
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
    }),
    defineField({
      name: "currentEdition",
      title: "Current edition",
      type: "reference",
      to: [{ type: "edition" }],
    }),
    defineField({
      name: "nav",
      title: "Navigation",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "label", type: "string", title: "Label" },
            { name: "href", type: "string", title: "URL" },
          ],
        },
      ],
    }),
    defineField({
      name: "instagram",
      title: "Instagram URL",
      type: "url",
    }),
    defineField({
      name: "contactEmail",
      title: "Contact email",
      type: "string",
    }),
  ],
});
