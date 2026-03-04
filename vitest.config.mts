import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "@shared": fileURLToPath(new URL("./app/(features)/_shared/", import.meta.url)),
      "@app-shared": fileURLToPath(new URL("./app/_shared/", import.meta.url)),
      "@feature-lib": fileURLToPath(new URL("./lib/features/", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
})
