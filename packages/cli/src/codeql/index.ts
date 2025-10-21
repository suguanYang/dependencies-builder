import path from 'path'
import { cpSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { replaceTscAliasPaths } from 'tsc-alias'
import { getTsconfig } from 'get-tsconfig'
import { CodeQL } from './codeql-runner'
import { buildCallGraphQuery, buildQueries, processQuery } from './queries'
import { getContext } from '../context'
import debug, { error } from '../utils/debug'
import { existsSync } from '../utils/fs-helper'

export const runCodeQL = async () => {
  await postRun()

  buildQueries()

  const codeql = new CodeQL()

  await codeql.run()

  const results = processQuery(codeql.outputPath)

  // const callGraphQuery = buildCallGraphQuery(results.nodes)
  // await codeql.runSingleQuery(callGraphQuery, 'callGraph')

  // const callGraphResults = await codeql.decodeSingleResult<string>('callGraph')
  const callGraphResults: string[] = []

  return {
    ...results,
    callGraph: callGraphResults
  }
}

const postRun = async () => {
  const ctx = getContext()
  const tsconfig = path.join(ctx.getWorkingDirectory(), 'tsconfig.json')

  if (existsSync(path.join(ctx.getWorkingDirectory(), 'dist'))) {
    rmSync(path.join(ctx.getWorkingDirectory(), 'dist'), { recursive: true })
  }

  debug('Copying src/**/*.{ts,tsx} to dist/')
  cpSync(path.join(ctx.getWorkingDirectory(), 'src'), path.join(ctx.getWorkingDirectory(), 'dist'), { recursive: true })

  // ignore extends in tsconfig.json
  const tsconfigResult = getTsconfig(tsconfig)

  if (!tsconfigResult) {
    return;
  }

  if (tsconfigResult.config) {
    // @ts-ignore
    tsconfigResult.config.extends = undefined
    writeFileSync(tsconfig, JSON.stringify(tsconfigResult.config, null, 2))
  }

  debug('Replacing tsc-alias paths')
  await replaceTscAliasPaths({
    configFile: tsconfig,
    resolveFullPaths: false,
    output: {
      verbose: true,
      debug: () => { },
      clear: () => { },
      assert: () => { },
      info: debug,
      error: error,
    },
    fileExtensions: {
      inputGlob: '{ts,tsx}',
      outputCheck: ['ts', 'tsx', 'js', 'jsx'],
    },
    declarationDir: 0 as any
  })
}