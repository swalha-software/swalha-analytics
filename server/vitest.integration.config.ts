import { defineConfig } from "vitest/config";

// Integration tests run against a real Postgres (the same container the
// swalha-auth repo uses for its tests: `pnpm db:start` there, port 5434),
// in their own database created and migrated by tests/integration/setup/global.ts.
// Env is set here, before any module loads, so postgres.ts picks it up.
const testEnv = {
  NODE_ENV: "test",
  POSTGRES_HOST: process.env.TEST_POSTGRES_HOST ?? "localhost",
  POSTGRES_PORT: process.env.TEST_POSTGRES_PORT ?? "5434",
  POSTGRES_DB: process.env.TEST_POSTGRES_DB ?? "swalha_analytics_test",
  POSTGRES_USER: process.env.TEST_POSTGRES_USER ?? "postgres",
  POSTGRES_PASSWORD: process.env.TEST_POSTGRES_PASSWORD ?? "password",
  SWALHA_SSO_CLIENT_ID: "test-client",
  SWALHA_SSO_CLIENT_SECRET: "test-secret",
};
Object.assign(process.env, testEnv);

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/integration/setup/global.ts"],
    setupFiles: ["./tests/integration/setup/each.ts"],
    fileParallelism: false,
    env: testEnv,
  },
});
