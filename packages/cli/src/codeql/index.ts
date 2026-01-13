import path from 'path'
import { cpSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { replaceTscAliasPaths } from 'tsc-alias'
import { parse } from 'jsonc-parser'

import { CodeQL } from './codeql-runner'
import { buildCallGraphQuery, buildQueries, processQuery } from './queries'
import { getContext } from '../context'
import debug, { error } from '../utils/debug'
import { existsSync } from '../utils/fs-helper'
import { PACKAGE_ROOT } from '../utils/constant'

export const runCodeQL = async () => {
  await postRun()

  buildQueries()

  const codeql = new CodeQL()

  await codeql.run()

  const results = processQuery(codeql.outputPath)

  const ctx = getContext()
  const ignoreCallGraph = ctx.getIgnoreCallGraph()

  let callGraphResults: [string, string][] = []

  if (!ignoreCallGraph) {
    const callGraphQuery = buildCallGraphQuery(results.nodes)
    if (callGraphQuery) {
      await codeql.runSingleQuery(callGraphQuery, 'callGraph')
      callGraphResults = await codeql.decodeSingleResult<[string, string]>('callGraph')
    }
  }

  return {
    ...results,
    callGraph: withFullPathCallGraph(callGraphResults),
    version: ctx.getVersion(),
  }
}
export type RunCodeQLResult = Awaited<ReturnType<typeof runCodeQL>>

const STANDALONE_APPS = [
  'main',
  'main-mobile',
  'login',
  'login-mobile',
  'm5-desktop',
  'oauth',
  'm5-login',
]

const postRun = async () => {
  const ctx = getContext()
  const tsconfig = path.join(ctx.getWorkingDirectory(), 'tsconfig.json')

  if (existsSync(path.join(ctx.getWorkingDirectory(), 'dist'))) {
    rmSync(path.join(ctx.getWorkingDirectory(), 'dist'), { recursive: true })
  }

  const appName = ctx.getProjectName()

  debug('Copying src/**/*.{ts,tsx} to dist/')
  cpSync(
    path.join(ctx.getWorkingDirectory(), 'src'),
    path.join(ctx.getWorkingDirectory(), 'dist'),
    {
      recursive: true,
      filter(source) {
        if (!STANDALONE_APPS.includes(appName)) {
          if (source.endsWith('.html')) {
            return false
          }
        }

        // 这个文件会造成很多全局变量读写噪音
        if (source.endsWith('iconfont.js')) {
          return false
        }

        // 遗留代码, 忽略
        if (source.includes('/legacy-udc/')) {
          return false
        }

        return true
      },
    },
  )

  // ignore extends in tsconfig.json
  const tsconfigResult = parse(readFileSync(tsconfig, 'utf8'))

  if (!tsconfigResult) {
    return
  }

  if (tsconfigResult) {
    tsconfigResult.extends = undefined
    if (!tsconfigResult.compilerOptions) {
      tsconfigResult.compilerOptions = {}
    }
    tsconfigResult.compilerOptions.outDir = 'dist'
    writeFileSync(tsconfig, JSON.stringify(tsconfigResult, null, 2))
  }

  debug('Replacing tsc-alias paths')
  await replaceTscAliasPaths({
    configFile: tsconfig,
    resolveFullPaths: false,
    output: {
      verbose: true,
      debug: () => {},
      clear: () => {},
      assert: () => {},
      info: debug,
      error: error,
    },
    fileExtensions: {
      inputGlob: '{ts,tsx}',
      outputCheck: ['ts', 'tsx', 'js', 'jsx'],
    },
    declarationDir: 0 as any,
    replacers: [path.join(PACKAGE_ROOT, 'replacer.js')],
  })
}

const withFullPathCallGraph = (callGraphResults: [string, string][]) => {
  const ctx = getContext()

  // Calculate the relative path from repository root to working directory
  const repoDir = ctx.getRepositoryDir()
  const workDir = ctx.getWorkingDirectory()
  const packageRelativePath = repoDir === workDir ? '' : path.relative(repoDir, workDir)

  return callGraphResults.map(([from, to]) => {
    return [path.join(packageRelativePath, from), path.join(packageRelativePath, to)]
  })
}
