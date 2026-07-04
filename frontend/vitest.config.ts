import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.tsx"],
    globals: false,
    css: true,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
