import { CodeQL } from './codeql-runner'
import { buildQueries, processQuery } from './queries'

export const runCodeQL = async () => {
  buildQueries()

  const codeql = new CodeQL()

  await codeql.run()

  return processQuery(codeql.outputPath)
}
