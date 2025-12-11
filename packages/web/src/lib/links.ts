import { Node } from './server-types'

/**
 * Generate a permanent link to the source code in GitLab
 * Format: {projectAddr}/-/blob/{version}/{relativePath}#L{startLine}
 */
export function generatePermanentLink(node: Node, projectAddr?: string): string | null {
    if (!projectAddr || !node.relativePath || node.startLine === undefined) {
        return null
    }

    let baseAddr = projectAddr.replace(/\.git$/, '')

    // Remove trailing slash if present
    baseAddr = baseAddr.replace(/\/$/, '')

    return `${baseAddr}/-/blob/${node.version}/${node.relativePath}#L${node.startLine}`
}
