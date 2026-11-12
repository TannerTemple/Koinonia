import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // The shared package is TypeScript source, so bundle it into the server.
  noExternal: ["@koinonia/shared"],
});
