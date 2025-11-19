import { batchCreateNodes, updateAction } from '../api'
import type { RunCodeQLResult } from '../codeql'
import { getContext } from '../context'
import debug, { error as errLog } from '../utils/debug'

export interface UploadResult {
  success: boolean
  message: string
  uploadedNodes: number
  errors?: string[]
}

export async function uploadResults(results: RunCodeQLResult): Promise<UploadResult> {
  debug('Uploading results to server')

  try {
    // Prepare nodes for upload with projectId and projectName
    const nodesToUpload = results.nodes.map((node: any) => ({
      projectName: node.projectName,
      branch: node.branch,
      type: node.type,
      name: node.name,
      relativePath: node.relativePath,
      startLine: node.startLine,
      startColumn: node.startColumn,
      endLine: node.endLine,
      endColumn: node.endColumn,
      version: node.version,
      meta: node.meta,
    }))

    debug('Uploading %d nodes to server', nodesToUpload.length)

    // Upload nodes in batches to avoid overwhelming the server
    const batchSize = 100
    const batches = []
    for (let i = 0; i < nodesToUpload.length; i += batchSize) {
      batches.push(nodesToUpload.slice(i, i + batchSize))
    }

    let totalUploaded = 0
    const errors: string[] = []

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      debug('Uploading batch %d/%d (%d nodes)', i + 1, batches.length, batch.length)

      try {
        const result = await batchCreateNodes(batch)

        totalUploaded += batch.length
        debug('Batch %d uploaded successfully: %s', i + 1, result.message)
      } catch (error) {
        errors.push(`Batch ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('/n'))
    }

    return {
      success: true,
      message: `Successfully uploaded ${totalUploaded} nodes to server`,
      uploadedNodes: totalUploaded,
    }
  } catch (error) {
    errLog('Upload failed: %o', error)
    throw error
  }
}

export async function uploadReport(report: any) {
  const id = getContext().getActionId()

  if (!id) {
    return
  }

  return updateAction(id, {
    result: report,
  })
}
