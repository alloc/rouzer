import { defineConfig } from 'vitest/config'
import * as path from 'node:path'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: true,
    typecheck: {
      enabled: true,
      tsconfig: 'test/type-tests.tsconfig.json',
      include: ['test/**/*.test-d.ts'],
    },
  },
  resolve: {
    alias: {
      'rouzer/http': path.resolve('src/http.ts'),
      rouzer: path.resolve('src/index.ts'),
    },
  },
})
