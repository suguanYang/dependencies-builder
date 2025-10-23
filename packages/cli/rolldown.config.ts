import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'rolldown'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const sharedNodeOptions = defineConfig({
  platform: 'node',
  define: {
    __PROD__: 'true',
  },
  external: ['tsc-alias'],
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
})

export default nodeConfig
