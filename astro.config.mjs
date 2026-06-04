// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://lspf-2026.pages.dev",
  // Astro now uses static output by default. Dynamic preview routes still work
  // when pages set `prerender = false` and the Cloudflare adapter is used.
  output: "static",
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    domains: ["cdn.sanity.io", "images.lspf.photo", "picsum.photos", "format.creatorcdn.com"],
  },
});
