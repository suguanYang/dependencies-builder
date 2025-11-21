import path from 'node:path'
import { rmSync, writeFileSync } from 'node:fs'
import debug, { error } from '../utils/debug'
import { checkoutRepository } from '../checkout'
import { runCodeQL } from '../codeql'
import { getContext } from '../context'
import { uploadResults } from '../upload'
import { directoryExistsSync } from '../utils/fs-helper'
import { getAnyNodeByProjectBranchVersion } from '../api'

export async function analyzeProject(): Promise<void> {
  debug('Starting analysis')

  const ctx = getContext()

  try {
    await checkoutRepository()

    debug('Repository checked out')

    const node = await getAnyNodeByProjectBranchVersion(
      ctx.getProjectName(),
      ctx.getBranch(),
      ctx.getVersion()!,
    )

    if (node && node?.meta?.qlsVersion === ctx.getQlsVersion()) {
      debug(`already existing nodes for version: ${ctx.getVersion()}, qls: ${ctx.getQlsVersion()}`)
      process.exit(0)
    }

    // Handle monorepo package name search
    ctx.findPackageDirectory()

    const results = await runCodeQL()

    // Save results to file
    const outputPath = path.join(ctx.getLocalDirectory(), 'analysis-results.json')
    writeFileSync(outputPath, JSON.stringify(results, null, 2))

    debug('\n=== Uploading Results to Server ===')
    const uploadResult = await uploadResults(results)

    if (uploadResult.success) {
      debug(`✅ ${uploadResult.message}`)
    } else {
      error(uploadResult.errors)
    }

    debug('Analysis completed successfully!')
  } catch (err) {
    error('Analysis failed with context: ' + ctx.toString())
    throw err
  } finally {
    if (ctx.isRemote() && directoryExistsSync(path.join(ctx.getRepositoryDir()))) {
      rmSync(path.join(ctx.getRepositoryDir()), { recursive: true })
    }
  }
}
