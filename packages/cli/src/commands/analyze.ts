import path from 'node:path'
import { rmSync, writeFileSync } from 'node:fs'
import debug from '../utils/debug'
import { checkoutRepository } from '../checkout'
import { runCodeQL } from '../codeql'
import { getContext } from '../context'
import { uploadResults } from '../upload'
import { directoryExistsSync } from '../utils/fs-helper'

export async function analyzeProject(): Promise<void> {
  debug('Starting analysis')

  const ctx = getContext()

  try {
    if (ctx.isRemote()) {
      await checkoutRepository()

      debug('Repository checked out')
    }

    // Handle monorepo package name search
    ctx.findPackageDirectory()

    const results = await runCodeQL()

    // Display results summary
    console.log('\n=== Analysis Results ===')
    console.log(`Project: ${results.summary.projectName}`)
    console.log(`Branch: ${results.summary.branch}`)
    console.log(`Version: ${results.summary.version}`)
    console.log(`Total Nodes Found: ${results.summary.totalNodes}`)
    console.log('\nNodes by Type:')
    Object.entries(results.summary.nodesByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })

    // Save results to file
    const outputPath = path.join(ctx.getLocalDirectory(), 'analysis-results.json')
    writeFileSync(outputPath, JSON.stringify(results, null, 2))
    console.log(`\nResults saved to: ${outputPath}`)

    // Step 6: Upload to server
    console.log('\n=== Uploading Results to Server ===')
    const uploadResult = await uploadResults(results)

    if (uploadResult.success) {
      console.log(`✅ ${uploadResult.message}`)
    } else {
      console.log(`❌ ${uploadResult.message}`)
      if (uploadResult.errors) {
        console.log('Errors:')
        uploadResult.errors.forEach((error) => console.log(`  - ${error}`))
      }
    }

    debug('Analysis completed successfully!')
  } catch (error) {
    debug('Analysis failed: %o', error)
    throw error
  } finally {
    if (ctx.isRemote() && directoryExistsSync(path.join(ctx.getRepositoryDir()))) {
      rmSync(path.join(ctx.getRepositoryDir()), { recursive: true })
    }
  }
}
