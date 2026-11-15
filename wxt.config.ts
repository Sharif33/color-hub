import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"

export default defineConfig({
  srcDir: "src",
  outDir: "dist",
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()]
  }),
  // Explicit imports only. Auto-imports would let an injected function use a
  // src/utils helper with no type error, then throw on the page
  imports: false,
  manifest: {
    name: "Color Hub",
    permissions: [
      "activeTab",
      "tabs",
      "storage",
      "unlimitedStorage",
      "scripting",
      "contextMenus"
    ],
    host_permissions: ["<all_urls>"]
  },
  zip: {
    // Same name the release workflow publishes
    artifactTemplate:
      "color-hub-v{{packageVersion}}-{{browser}}{{modeSuffix}}.zip"
  }
})
