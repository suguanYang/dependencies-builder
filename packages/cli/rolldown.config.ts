import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'rolldown'

import pkg from './package.json'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const sharedNodeOptions = defineConfig({
  platform: 'node',
  define: {
    __PROD__: 'true',
  },
  output: {
    dir: './dist',
    entryFileNames: `[name].js`,
    chunkFileNames: `[name].js`,
    exports: 'named',
    format: 'esm',
    preserveModules: false,
    externalLiveBindings: false,
    minify: false,
  },
  onwarn(warning, warn) {
    warn(warning)
  },
})

const nodeConfig = defineConfig({
  ...sharedNodeOptions,
  input: {
    index: path.resolve(__dirname, 'src/index.ts'),
  },
  external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
})

export default nodeConfig
