import { defineConfig } from 'vitest/config';

// unit: pure logic (no network, no database)
// integration: real PostgreSQL (TEST_DATABASE_URL), the Fastify API through app.inject() and the bot with a recorded Bot API
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], environment: 'node', fileParallelism: false, testTimeout: 30_000, hookTimeout: 60_000 } }
    ]
  }
});
