import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  test: {
    setupFiles: ['./test/setup.ts'],
    globals: true,
    environment: 'node',
    env: loadEnv(mode, process.cwd(), ''),
    deps: {
      interopDefault: true,
      optimizer: {
        ssr: {
          include: [
            '@prisma/client',
            /@prisma\/.*/,
          ],
        },
      },
    },
  },
}))
