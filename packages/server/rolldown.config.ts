import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'rolldown'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url)).toString(),
)
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
})

const nodeConfig = defineConfig({
  ...sharedNodeOptions,
  input: {
    index: path.resolve(__dirname, 'src/index.ts')
  },
  external: [
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.peerDependencies),
  ]
})


export default nodeConfig
