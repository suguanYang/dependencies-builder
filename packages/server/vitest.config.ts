import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: './.env.test' })

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    globalSetup: './test/global-setup.ts',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    fileParallelism: true,
    exclude: ['src/native/sqlite-hook.test.ts', 'test/prod-db-tests'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
