// Standalone local fixture renderer. The application config and server are not loaded.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  appType: "mpa",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  cacheDir: ".codex-qa.local/onboarding-vite-cache",
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
