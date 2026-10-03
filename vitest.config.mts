import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname.replace(/^\/(\w:)/, "$1") } },
});
