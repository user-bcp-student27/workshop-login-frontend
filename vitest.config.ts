import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/app/**/*.ts', 'src/environments/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/app/app.component.ts', 'src/app/app.routes.ts'],
      thresholds: {
        perFile: true,
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85
      }
    }
  }
});
