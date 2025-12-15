import { cpSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'rolldown'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)).toString())
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const sharedNodeOptions = defineConfig({
  platform: 'node',
  output: {
    dir: './dist',
    entryFileNames: `[name].js`,
    exports: 'named',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: 'src',
    externalLiveBindings: false,
  },
  onwarn(warning, warn) {
    warn(warning)
  },
  plugins: [
    {
      name: 'copy-transport',
      buildEnd() {
        // copy src/logging/transport.js
        cpSync(
          path.resolve(__dirname, 'src/logging/transport.js'),
          path.resolve(__dirname, 'dist/logging/transport.js'),
        )

        // cp src/generated/prisma to dist/generated/prisma
        cpSync(
          path.resolve(__dirname, 'src/generated/prisma'),
          path.resolve(__dirname, 'dist/generated/prisma'),
          { recursive: true },
        )
      },
    },
  ],
})

const nodeConfig = defineConfig({
  ...sharedNodeOptions,
  input: {
    index: path.resolve(__dirname, 'src/index.ts'),
    'workers/connection-worker': path.resolve(__dirname, 'src/workers/connection-worker.ts'),
    'workers/dependency-builder-worker': path.resolve(__dirname, 'src/workers/dependency-builder-worker.ts'),
  },
  external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
})

export default nodeConfig
