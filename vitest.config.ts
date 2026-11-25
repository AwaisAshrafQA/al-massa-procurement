import { defineConfig } from "vitest/config";

// API tests run against the linked Supabase project, signed in as each demo user.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
