import path from 'node:path'
import { writeFileSync } from 'node:fs'

import { getContext } from '../context'
import { CodeQL } from './codeql-runner'
import getEntries from './repositories/entries'
import { entryExportsQuery } from './queries/query.ql'

export const cleanUp = () => {
  const codeql = new CodeQL()
  codeql.cleanUp()
}

export const runCodeQL = async () => {
  buildQueries()

  const codeql = new CodeQL()
  return codeql.run()
}

const buildQueries = () => {
  const ctx = getContext()
  const entries = getEntries()

  const entryQuery = entryExportsQuery.replace('$$entryQuery$$', entries.map(entry => `f.getRelativePath() = "${entry}"`).join(' or '))

  writeFileSync(path.join(ctx.getRepository(), 'queries', 'entry-exports.ql'), entryQuery)
}