import debug from '../utils/debug'

export interface UploadResult {
  success: boolean
  message: string
  uploadedNodes: number
  errors?: string[]
}

export async function uploadResults(results: any): Promise<UploadResult> {
  const serverUrl = process.env.DMS_SERVER_URL || 'http://127.0.0.1:3001'

  debug('Uploading results to server: %s', serverUrl)

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
      meta: node.meta
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
        const response = await fetch(`${serverUrl}/nodes/batch-create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        })

        if (!response.ok) {
          const errorText = await response.text()
          errors.push(`Batch ${i + 1}: ${response.status} - ${errorText}`)
          continue
        }

        const result = await response.json() as { message: string }
        totalUploaded += batch.length
        debug('Batch %d uploaded successfully: %s', i + 1, result.message)
      } catch (error) {
        errors.push(`Batch ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: `Upload completed with ${errors.length} errors`,
        uploadedNodes: totalUploaded,
        errors
      }
    }

    return {
      success: true,
      message: `Successfully uploaded ${totalUploaded} nodes to server`,
      uploadedNodes: totalUploaded
    }
  } catch (error) {
    debug('Upload failed: %o', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: 'Upload failed',
      uploadedNodes: 0,
      errors: [errorMessage]
    }
  }
}