import path from 'path'
import { cpSync, rmSync } from 'fs'
import { replaceTscAliasPaths } from 'tsc-alias'
import { CodeQL } from './codeql-runner'
import { buildQueries, processQuery } from './queries'
import { getContext } from '../context'
import debug, { error } from '../utils/debug'
import { existsSync } from '../utils/fs-helper'

export const runCodeQL = async () => {
  await postRun()

  buildQueries()

  const codeql = new CodeQL()

  await codeql.run()

  return processQuery(codeql.outputPath)
}

const postRun = async () => {
  const ctx = getContext()
  const tsconfig = path.join(ctx.getWorkingDirectory(), 'tsconfig.json')

  if (existsSync(path.join(ctx.getWorkingDirectory(), 'dist'))) {
    rmSync(path.join(ctx.getWorkingDirectory(), 'dist'), { recursive: true })
  }

  debug('Copying src/**/*.{ts,tsx} to dist/')
  cpSync(path.join(ctx.getWorkingDirectory(), 'src'), path.join(ctx.getWorkingDirectory(), 'dist'), { recursive: true })

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