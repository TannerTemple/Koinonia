import { defineConfig } from "vitest/config";

// Only the pure logic is unit tested here (no React Native runtime needed).
export default defineConfig({ test: { include: ["src/lib/**/*.test.ts"] } });
