import path from 'node:path'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import debug from '../utils/debug'
import { checkoutRepository } from '../checkout'
import { getContext } from '../context'
import run from '../utils/run'
import { Results } from '../codeql/queries'
import { directoryExistsSync } from '../utils/fs-helper'
import { uploadReport } from '../upload'
import { getConnectionsByToNode, getProjectByName } from '../api'
import { Connection, LocalNode, Node } from '../server-types'
import { analyzeImpact, type ImpactReport } from '../llm/analyzer'
import { generateNodeId } from '../utils/node-id'

interface ReportResult {
  affectedToNodes: LocalNode[]
  version: string
  affecatedConnections: Connection[]
  impactAnalysis?: ImpactReport | null
}

interface ChangedLine {
  file: string
  changes: { line: number; content: string; hunk: string }[]
}

interface AffectedProject {
  name: string
  directory: string
}

async function findAffectedProjects(
  repoDir: string,
  changedLines: ChangedLine[],
): Promise<AffectedProject[]> {
  const affectedProjects = new Map<string, string>()

  for (const change of changedLines) {
    let dir = path.dirname(path.join(repoDir, change.file))

    while (dir.startsWith(repoDir)) {
      const pkgPath = path.join(dir, 'package.json')
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
          if (pkg.name && !affectedProjects.has(pkg.name)) {
            // Validate project exists in server
            try {
              if (await getProjectByName(pkg.name)) {
                affectedProjects.set(pkg.name, dir)
              }
            } catch (error) {
              debug(
                'Skipping project %s: not found in server or validation failed (%s)',
                pkg.name,
                error,
              )
            }
          }
        } catch {
          /* skip invalid package.json */
        }
        break
      }

      if (dir === repoDir) {
        break
      }

      dir = path.dirname(dir)
    }
  }

  return Array.from(affectedProjects, ([name, directory]) => ({ name, directory }))
}

function getAnalysisResults(
  targetBranch: string,
  projectName: string,
): Results & {
  callGraph: [string, string][]
  version: string
} {
  const ctx = getContext()
  const resFile = path.join(
    ctx.getLocalDirectory(targetBranch, projectName),
    'analysis-results.json',
  )
  if (!existsSync(resFile)) {
    throw new Error(`Analysis results ${resFile} file not found`)
  }
  return JSON.parse(readFileSync(resFile, 'utf-8'))
}

export async function generateReport(): Promise<void> {
  debug('Starting multi-project report generation')

  const ctx = getContext()
  const targetBranch = ctx.getTargetBranch()!
  const repoDir = ctx.getRepositoryDir()

  try {
    await checkoutRepository()
    debug('Repository checked out')

    const workingDir = ctx.getWorkingDirectory()

    debug('Getting diff with target branch: %s', targetBranch)
    const changedLines = await getDiffChangedLines(workingDir, targetBranch)
    debug('Changed lines across repo: %d files', changedLines.length)

    const affectedProjects = await findAffectedProjects(repoDir, changedLines)
    debug('Affected projects: %s', affectedProjects.map((p) => p.name).join(', '))

    if (affectedProjects.length === 0) {
      debug('No affected projects found in changed files')
      await uploadReport({
        affectedToNodes: [],
        version: '',
        affecatedConnections: [],
      })
      return
    }

    const allAffectedToNodes: LocalNode[] = []
    const allChangedContext = new Map<string, string[]>()

    for (const project of affectedProjects) {
      debug('Processing project: %s', project.name)

      try {
        const results = getAnalysisResults(targetBranch, project.name)
        debug('Project %s: %d nodes', project.name, results.nodes.length)

        const { nodes: affectedToNodes, context: changedContext } = await findAffectedToNodes(
          results.nodes,
          results.callGraph,
          changedLines,
        )

        debug('Project %s: %d affected nodes', project.name, affectedToNodes.length)

        allAffectedToNodes.push(...affectedToNodes)

        for (const [nodeId, contexts] of changedContext) {
          if (allChangedContext.has(nodeId)) {
            allChangedContext.get(nodeId)!.push(...contexts)
          } else {
            allChangedContext.set(nodeId, [...contexts])
          }
        }
      } catch (error) {
        debug('Failed to process project %s: %o', project.name, error)
      }
    }

    debug('Total affected nodes across all projects: %d', allAffectedToNodes.length)

    const affecatedConnections = (
      await Promise.all(allAffectedToNodes.map((node) => getConnectionsByToNode(node)))
    ).flat()

    let impactAnalysis: ImpactReport | null = null
    try {
      if (affecatedConnections.length > 0) {
        debug('Starting LLM-based impact analysis on combined results...')
        impactAnalysis = await analyzeImpact({
          projectAddr: ctx.getRepository(),
          sourceBranch: ctx.getBranch(),
          targetBranch,
          affectedToNodes: allAffectedToNodes,
          affectedConnections: affecatedConnections,
          changedContext: allChangedContext,
        })
      } else {
        debug('skip LLM analysis due to no affecatedConnections found')
      }
    } catch (error) {
      debug('LLM analysis failed: %o', error)
    }

    const reportResult: ReportResult = {
      affectedToNodes: allAffectedToNodes,
      version: ctx.getVersion(),
      affecatedConnections,
      impactAnalysis,
    }
    const optimizedReport = optimizeReport(reportResult)

    await uploadReport(optimizedReport)
    debug('Multi-project report generation completed successfully!')
  } catch (error) {
    debug('Report generation failed: %o', error)
    throw error
  } finally {
    if (ctx.isRemote() && directoryExistsSync(path.join(ctx.getRepositoryDir()))) {
      rmSync(path.join(ctx.getRepositoryDir()), { recursive: true })
    }
  }
}

async function getDiffChangedLines(
  workingDir: string,
  targetBranch: string,
): Promise<ChangedLine[]> {
  try {
    const diffOutput = await run(
      'git',
      ['diff', `${targetBranch}...HEAD`, '--unified=0'],
      { cwd: workingDir },
      true,
    )

    const changedLines: ChangedLine[] = []
    let currentFile = ''
    const lines = diffOutput.split('\n')

    // Intermediate structure to hold hunks before processing
    let currentHunkLines: string[] = []
    let currentStartLine = 0

    // Helper to process the completed hunk
    const processHunk = () => {
      if (currentHunkLines.length > 0 && currentFile) {
        let existingEntry = changedLines.find((entry) => entry.file === currentFile)
        if (!existingEntry) {
          existingEntry = { file: currentFile, changes: [] }
          changedLines.push(existingEntry)
        }

        const hunkString = currentHunkLines.join('\n')
        let lineOffset = 0

        for (const line of currentHunkLines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            const content = line.substring(1)
            existingEntry.changes.push({
              line: currentStartLine + lineOffset,
              content,
              hunk: hunkString,
            })
            lineOffset++
          }
        }
      }
    }

    for (const line of lines) {
      if (line.startsWith('+++')) {
        processHunk() // Finish previous hunk
        currentHunkLines = []

        currentFile = line.substring(6).trim()
        if (currentFile.startsWith('b/')) {
          currentFile = currentFile.substring(2)
        }
        continue
      }

      // Skip file headers for original file but make sure to finish previous hunk
      if (line.startsWith('---')) {
        processHunk()
        currentHunkLines = []
        continue
      }

      if (line.startsWith('@@')) {
        processHunk() // Finish previous hunk
        currentHunkLines = []

        // Parse new start line
        // @@ -old_start,old_count +new_start,new_count @@
        const rangeMatch = line.match(/@@ \-\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
        if (rangeMatch) {
          currentStartLine = parseInt(rangeMatch[1])
        }
        currentHunkLines.push(line)
        continue
      }

      // Accumulate lines for the current hunk
      if (
        (line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---'))
      ) {
        currentHunkLines.push(line)
      } else if (line.startsWith('\\ No newline')) {
        // Handle no newline marker if needed, usually just skip or append
        currentHunkLines.push(line)
      }
    }

    // Process last hunk
    processHunk()

    // Filter relevant files (js/ts/src)
    return changedLines
  } catch (error) {
    debug('Failed to get diff: %o', error)
    return []
  }
}

async function findAffectedToNodes(
  nodes: Results['nodes'],
  callGraph: [string, string][],
  changedLines: ChangedLine[],
): Promise<{ nodes: LocalNode[]; context: Map<string, string[]> }> {
  const affectedNodes = new Set<string>() // Use IDs to track uniqueness efficiently if needed, but here we invoke object equality which is tricky if objects are recreated. Let's use the object itself but handle dupes carefully.
  const affectedNodesList: LocalNode[] = []
  const nodeContext = new Map<string, Set<string>>() // Node ID -> Set of changed code lines

  const toNodes = nodes.filter(
    (node) =>
      node.type === 'NamedExport' ||
      node.type === 'GlobalVarWrite' ||
      node.type === 'WebStorageWrite' ||
      node.type === 'EventEmit',
  )

  for (const edge of callGraph) {
    const rootNode = edge[0]
    const toNode = toNodes.find(
      (node) =>
        `${node.relativePath}:${node.startLine}:${node.startColumn}:${node.endLine}:${node.endColumn}` ===
        rootNode,
    )

    if (!toNode) {
      continue
    }

    let isAffected = false

    for (const location of edge) {
      const [relativePath, startLine, _startColumn, endLine, _endColumn] = location.split(':')

      const fileChanges = changedLines.find((cl) => cl.file === relativePath)
      if (fileChanges) {
        const start = parseInt(startLine)
        const end = parseInt(endLine)

        const affectingChanges = fileChanges.changes.filter((c) => c.line >= start && c.line <= end)

        if (affectingChanges.length > 0) {
          isAffected = true

          const nodeId = generateNodeId(toNode)

          if (!nodeContext.has(nodeId)) {
            nodeContext.set(nodeId, new Set())
          }
          const contextSet = nodeContext.get(nodeId)!

          affectingChanges.forEach((change) => {
            // Include hunk for context. Deduplication is handled by Set.
            contextSet.add(`File: ${relativePath}\n${change.hunk}`)
          })
        }
      }
      if (isAffected) {
        const nodeId = generateNodeId(toNode)
        if (!affectedNodes.has(nodeId)) {
          affectedNodes.add(nodeId)
          affectedNodesList.push(toNode)
        }
      }
    }
  }

  // Convert Sets to Arrays for final output
  const contextMap = new Map<string, string[]>()
  for (const [id, set] of nodeContext) {
    contextMap.set(id, Array.from(set))
  }

  return { nodes: affectedNodesList, context: contextMap }
}

interface MinimalNode {
  name: string
  projectName: string
  type: string
  version: string
  relativePath: string
  startLine: number
  project?: {
    addr: string
  }
}

function toMinimalNode(node: LocalNode | Node): MinimalNode {
  return {
    name: node.name,
    projectName: node.projectName,
    type: node.type,
    version: node.version,
    relativePath: node.relativePath,
    startLine: node.startLine,
    project: (node as any).project
      ? {
          addr: (node as any).project.addr,
        }
      : undefined,
  }
}
function optimizeReport(report: ReportResult): any {
  // Map affectedToNodes to MinimalNode
  const minimalNodes = report.affectedToNodes.map(toMinimalNode)

  // Map affectedConnections to use MinimalNode
  const minimalConnections = report.affecatedConnections.map((conn) => ({
    ...conn,
    fromNode: toMinimalNode(conn.fromNode),
    toNode: toMinimalNode(conn.toNode),
    // Remove raw nodes if they exist as separate fields (Connection type has fromNode/toNode)
    // We strictly return a new object structure that matches what the server/UI expects
    // but with trimmed node objects.
  }))

  return {
    ...report,
    affectedToNodes: minimalNodes,
    affecatedConnections: minimalConnections,
  }
}
