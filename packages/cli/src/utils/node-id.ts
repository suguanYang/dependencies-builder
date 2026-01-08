import { LocalNode } from '../server-types'

export function generateNodeId(node: LocalNode): string {
  return `${node.projectName}:${node.branch}:${node.relativePath}:${node.type}:${node.name}:${node.startLine}:${node.startColumn}:${node.endLine}:${node.endColumn}:${node.qlsVersion ?? '0.1.0'}`
}
