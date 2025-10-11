import path from 'node:path'
import { writeFileSync } from 'node:fs'
import debug from '../utils/debug'
import { checkoutRepository } from '../checkout'
import { runCodeQL } from '../codeql'
import { getContext } from '../context'
import run from '../utils/run'
import { CodeQL } from '../codeql/codeql-runner'
import type { Results } from '../codeql/queries'

interface ReportResult {
  affectedToNodes: any[]
  deletedToNodesWithConnections: any[]
  newFromNodesWithoutTo: any[]
  summary: {
    totalAffectedToNodes: number
    totalDeletedToNodesWithConnections: number
    totalNewFromNodesWithoutTo: number
  }
}

export async function generateReport(targetBranch: string): Promise<void> {
  debug('Starting report generation')

  const ctx = getContext()
  const serverUrl = process.env.DMS_SERVER_URL || 'http://localhost:3001'

  try {
    if (ctx.isRemote()) {
      await checkoutRepository()
      debug('Repository checked out')
    }

    const currentBranch = ctx.getBranch()
    const workingDir = ctx.getWorkingDirectory()

    const results = await runCodeQL()
    debug('CodeQL analysis completed')

    debug('Getting diff with target branch: %s', targetBranch)
    const changedLines = await getDiffChangedLines(workingDir, currentBranch, targetBranch)
    debug('Changed lines: %d', changedLines.length)

    debug('Finding affected "to nodes"')
    const affectedToNodes = await findAffectedToNodes(results.nodes, changedLines)
    debug('Affected to nodes: %d', affectedToNodes.length)

    debug('Finding deleted "to nodes"')
    const deletedToNodes = findDeletedToNodes(results.nodes, changedLines)
    debug('Deleted to nodes: %d', deletedToNodes.length)

    debug('Checking deleted "to nodes" on server')
    const deletedToNodesWithConnections = await checkDeletedNodesOnServer(
      serverUrl,
      deletedToNodes,
      ctx.getMetadata().name,
      currentBranch
    )
    debug('Deleted to nodes with connections: %d', deletedToNodesWithConnections.length)

    debug('Finding new "from nodes"')
    const newFromNodes = findNewFromNodes(results.nodes, changedLines)
    debug('New from nodes: %d', newFromNodes.length)

    debug('Checking new "from nodes" on server')
    const newFromNodesWithoutTo = await checkNewFromNodesOnServer(
      serverUrl,
      newFromNodes
    )
    debug('New from nodes without to: %d', newFromNodesWithoutTo.length)

    const reportResult: ReportResult = {
      affectedToNodes,
      deletedToNodesWithConnections,
      newFromNodesWithoutTo,
      summary: {
        totalAffectedToNodes: affectedToNodes.length,
        totalDeletedToNodesWithConnections: deletedToNodesWithConnections.length,
        totalNewFromNodesWithoutTo: newFromNodesWithoutTo.length
      }
    }

    const reportPath = path.join(workingDir, 'report.json')
    writeFileSync(reportPath, JSON.stringify(reportResult, null, 2))
    console.log(`\nReport saved to: ${reportPath}`)

    console.log('\n=== Dependency Report ===')
    console.log(`Project: ${ctx.getMetadata().name}`)
    console.log(`Current Branch: ${currentBranch}`)
    console.log(`Target Branch: ${targetBranch}`)
    console.log(`\nSummary:`)
    console.log(`  Affected "to nodes": ${reportResult.summary.totalAffectedToNodes}`)
    console.log(`  Deleted "to nodes" with connections: ${reportResult.summary.totalDeletedToNodesWithConnections}`)
    console.log(`  New "from nodes" without "to node": ${reportResult.summary.totalNewFromNodesWithoutTo}`)

    if (deletedToNodesWithConnections.length > 0) {
      console.log('\n⚠️  Warning: Some deleted "to nodes" still have connections:')
      deletedToNodesWithConnections.forEach(node => {
        console.log(`  - ${node.name} (${node.type}) in ${node.relativePath}:${node.startLine}`)
      })
    }

    if (newFromNodesWithoutTo.length > 0) {
      console.log('\n⚠️  Warning: Some new "from nodes" have no matching "to node":')
      newFromNodesWithoutTo.forEach(node => {
        console.log(`  - ${node.name} (${node.type}) in ${node.relativePath}:${node.startLine}`)
      })
    }

    debug('Report generation completed successfully!')
  } catch (error) {
    debug('Report generation failed: %o', error)
    throw error
  }
}

async function getCallGraphForNode(nodes: Results['nodes']): Promise<string[]> {
  try {
    const queryContent = `
/**
 * @name Call graph
 * @description Build call graph for specific node
 * @kind table
 * @id js/call-graph
 * @tags summary
 */

import javascript
import libs.callStack
import libs.location

from CallAbleNode parent, CallAbleNode leaf, string path
where
  (${nodes.map(node => `getLocation(parent) = "${node.relativePath}:${node.startLine}:${node.startColumn}:${node.endLine}:${node.endColumn}"`).join(' or \n')}) and
  isLeaf(leaf) and
  calls+(parent, leaf) and
  callStack(parent, leaf, path)
select path
`

    const queryName = `callGraph`
    const codeql = new CodeQL()
    await codeql.runSingleQuery(queryContent, queryName)
    return codeql.decodeSingleResult<string>(queryName)
  } catch (error) {
    debug('Failed to build call graph for node %s: %o', error)
  }

  return []
}

interface ChangedLine {
  file: string
  lines: number[]
}

async function getDiffChangedLines(workingDir: string, currentBranch: string, targetBranch: string): Promise<ChangedLine[]> {
  try {
    const diffOutput = await run('git', [
      'diff',
      `HEAD...${targetBranch}`,
      '--unified=0'
    ], { cwd: workingDir }, true)

    const changedLines: ChangedLine[] = []
    let currentFile = ''
    const lines = diffOutput.split('\n')

    for (const line of lines) {
      if (line.startsWith('+++')) {
        currentFile = line.substring(6).trim()
        if (currentFile.startsWith('b/')) {
          currentFile = currentFile.substring(2)
        }
        continue
      }

      // only check on js/jsx/ts/tsx files
      if (!currentFile.endsWith('.js') && !currentFile.endsWith('.jsx') && !currentFile.endsWith('.ts') && !currentFile.endsWith('.tsx')) {
        continue
      }

      // ignore non src files
      if (!currentFile.startsWith('src/')) {
        continue
      }

      if (line.startsWith('@@')) {
        const match = line.match(/\+(\d+)(?:,(\d+))?/)
        if (match && currentFile) {
          const startLine = parseInt(match[1])
          const count = match[2] ? parseInt(match[2]) : 1

          const existingEntry = changedLines.find(entry => entry.file === currentFile)
          const lineNumbers = Array.from({ length: count }, (_, i) => startLine + i)

          if (existingEntry) {
            existingEntry.lines.push(...lineNumbers)
          } else {
            changedLines.push({
              file: currentFile.replace('src/', ''),
              lines: lineNumbers
            })
          }
        }
      }
    }

    return changedLines
  } catch (error) {
    debug('Failed to get diff: %o', error)
    return []
  }
}

async function findAffectedToNodes(nodes: any[], changedLines: ChangedLine[]): Promise<any[]> {
  const affectedNodes = new Set<any>()

  const toNodes = nodes.filter(node =>
    node.type === 'NamedExport' ||
    node.type === 'GlobalVarWrite' ||
    node.type === 'WebStorageWrite' ||
    node.type === 'EventEmit'
  )


  debug('Building call-graph for callable "to nodes"')
  const callGraph = await getCallGraphForNode(toNodes)
  debug('Call graph: %d', callGraph.length)

  for (const callGraphNode of callGraph) {
    const path = callGraphNode[0]
    const locations = path.split('->')
    const toNode = toNodes.find(node => `${node.relativePath}:${node.startLine}:${node.startColumn}:${node.endLine}:${node.endColumn}` === locations[0])

    if (!toNode) {
      continue
    }

    if (affectedNodes.has(toNode)) {
      continue
    }

    let isAffected = false
    for (const location of locations) {
      const [relativePath, startLine, _startColumn, endLine, _endColumn] = location.split(':')
      for (const changedLine of changedLines) {
        if (changedLine.file === relativePath) {
          if (changedLine.lines.some(line => line >= parseInt(startLine) && line <= parseInt(endLine))) {
            affectedNodes.add(toNode)
            isAffected = true
            break
          }
        }
      }
      if (isAffected) {
        break
      }
    }
  }

  return Array.from(affectedNodes)
}

function findDeletedToNodes(nodes: any[], changedLines: ChangedLine[]): any[] {
  return []
}

function findNewFromNodes(nodes: any[], changedLines: ChangedLine[]): any[] {
  const newNodes: any[] = []

  const fromNodes = nodes.filter(node =>
    node.type === 'NamedImport' ||
    node.type === 'RuntimeDynamicImport' ||
    node.type === 'GlobalVarRead' ||
    node.type === 'WebStorageRead' ||
    node.type === 'EventOn'
  )

  for (const node of fromNodes) {
    const changedFile = changedLines.find(change =>
      node.relativePath && change.file.includes(node.relativePath)
    )

    if (changedFile) {
      const isNew = changedFile.lines.some(line =>
        line >= node.startLine && line <= node.endLine
      )

      if (isNew) {
        newNodes.push(node)
      }
    }
  }

  return newNodes
}

async function checkDeletedNodesOnServer(
  serverUrl: string,
  deletedNodes: any[],
  project: string,
  branch: string
): Promise<any[]> {
  const nodesWithConnections: any[] = []

  for (const node of deletedNodes) {
    try {
      const response = await fetch(
        `${serverUrl}/nodes?project=${encodeURIComponent(project)}&branch=${encodeURIComponent(branch)}&type=${node.type}&name=${encodeURIComponent(node.name)}&limit=1`
      )

      if (!response.ok) {
        continue
      }

      const result = await response.json() as { data: any[]; total: number }

      if (result.data.length > 0) {
        const nodeId = result.data[0].id

        const connectionsResponse = await fetch(
          `${serverUrl}/connections?toId=${nodeId}&limit=1`
        )

        if (connectionsResponse.ok) {
          const connectionsResult = await connectionsResponse.json() as { data: any[]; total: number }

          if (connectionsResult.total > 0) {
            nodesWithConnections.push({
              ...node,
              connectionCount: connectionsResult.total
            })
          }
        }
      }
    } catch (error) {
      debug('Failed to check node on server: %o', error)
    }
  }

  return nodesWithConnections
}

async function checkNewFromNodesOnServer(
  serverUrl: string,
  newFromNodes: any[]
): Promise<any[]> {
  const nodesWithoutTo: any[] = []

  for (const node of newFromNodes) {
    try {
      let toNodeType = ''
      let toNodeName = node.name

      switch (node.type) {
        case 'NamedImport':
          toNodeType = 'NamedExport'
          break
        case 'RuntimeDynamicImport':
          toNodeType = 'NamedExport'
          break
        case 'GlobalVarRead':
          toNodeType = 'GlobalVarWrite'
          break
        case 'WebStorageRead':
          toNodeType = 'WebStorageWrite'
          break
        case 'EventOn':
          toNodeType = 'EventEmit'
          break
        default:
          continue
      }

      const response = await fetch(
        `${serverUrl}/nodes?type=${toNodeType}&name=${encodeURIComponent(toNodeName)}&limit=1`
      )

      if (!response.ok) {
        nodesWithoutTo.push(node)
        continue
      }

      const result = await response.json() as { data: any[]; total: number }

      if (result.total === 0) {
        nodesWithoutTo.push(node)
      }
    } catch (error) {
      debug('Failed to check node on server: %o', error)
      nodesWithoutTo.push(node)
    }
  }

  return nodesWithoutTo
}

