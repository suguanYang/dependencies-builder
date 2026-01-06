import { Node } from '../server-types'

export function generateNodeId(
  node: Omit<Node, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
): string {
  return `${node.projectName}:${node.branch}:${node.relativePath}:${node.type}:${node.name}:${node.startLine}:${node.startColumn}:${node.endLine}:${node.endColumn}:${node.qlsVersion ?? '0.1.0'}`
}
