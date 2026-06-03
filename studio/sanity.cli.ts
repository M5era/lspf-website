import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: "nsxw1yrt",
    dataset: "production",
  },
  // Where studio will deploy to: lspf.sanity.studio
  // Run `npm run deploy` from the studio/ folder when ready.
  studioHost: "lspf",
});
