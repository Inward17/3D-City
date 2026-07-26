import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Kept separate from vite.config.ts so the dev/build config stays untouched.
 *
 * jsdom is needed because the stores and localRepo touch localStorage and
 * crypto.randomUUID; none of these tests render React components.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Left off deliberately: each test file imports describe/it/expect from
    // 'vitest', so tsconfig.app.json needs no extra `types` entry and the app
    // build config stays as it was.
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/utils/**', 'src/lib/**', 'src/store/**']
    }
  }
});
