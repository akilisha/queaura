import { defineConfig } from 'vitest/config';

// Database test files share one Postgres; run files one after another so they don't wipe each other.
export default defineConfig({ test: { fileParallelism: false } });
