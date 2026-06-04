// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://lspf-2026.pages.dev",
  // Hybrid: most pages stay prerendered (static, edge-served), only
  // /preview/* opts into SSR for live draft preview.
  output: "hybrid",
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    domains: ["cdn.sanity.io", "images.lspf.photo", "picsum.photos", "format.creatorcdn.com"],
  },
});
