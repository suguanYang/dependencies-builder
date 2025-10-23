import path from 'node:path'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import debug from '../utils/debug'
import { checkoutRepository } from '../checkout'
import { getContext } from '../context'
import run from '../utils/run'
import { Results } from '../codeql/queries'
import { directoryExistsSync } from '../utils/fs-helper'

interface ReportResult {
  affectedToNodes: any[]
}

export async function generateReport(): Promise<void> {
  debug('Starting report generation')

  const ctx = getContext()
  const targetBranch = ctx.getTargetBranch()!

  try {
    if (ctx.isRemote()) {
      await checkoutRepository()
      debug('Repository checked out')
    }

    ctx.findPackageDirectory()

    const workingDir = ctx.getWorkingDirectory()

    const results = getAnalysisResults(targetBranch)
    debug('Nodes: %d', results.nodes.length)

    debug('Getting diff with target branch: %s', targetBranch)
    const changedLines = await getDiffChangedLines(workingDir, targetBranch)
    debug('Changed lines: %d', changedLines.length)

    debug('Finding affected "to nodes"')
    const affectedToNodes = await findAffectedToNodes(
      results.nodes,
      results.callGraph,
      changedLines,
    )
    debug('Affected to nodes: %d', affectedToNodes.length)

    const reportResult: ReportResult = {
      affectedToNodes,
    }

    const reportPath = path.join(ctx.getLocalDirectory(), 'report.json')
    writeFileSync(reportPath, JSON.stringify(reportResult, null, 2))
    console.log(`\nReport saved to: ${reportPath}`)
    debug('Report generation completed successfully!')
  } catch (error) {
    debug('Report generation failed: %o', error)
    throw error
  } finally {
    if (ctx.isRemote() && directoryExistsSync(path.join(ctx.getRepositoryDir()))) {
      rmSync(path.join(ctx.getRepositoryDir()), { recursive: true })
    }
  }
}

function getAnalysisResults(targetBranch: string): Results & {
  callGraph: string[]
} {
  const ctx = getContext()
  const resFile = path.join(ctx.getLocalDirectory(targetBranch), 'analysis-results.json')
  if (!existsSync(resFile)) {
    throw new Error(`Analysis results ${resFile} file not found`)
  }
  return JSON.parse(readFileSync(resFile, 'utf-8'))
}

interface ChangedLine {
  file: string
  lines: number[]
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

    for (const line of lines) {
      if (line.startsWith('+++')) {
        currentFile = line.substring(6).trim()
        if (currentFile.startsWith('b/')) {
          currentFile = currentFile.substring(2)
        }
        continue
      }

      // only check on js/jsx/ts/tsx files
      if (
        !currentFile.endsWith('.js') &&
        !currentFile.endsWith('.jsx') &&
        !currentFile.endsWith('.ts') &&
        !currentFile.endsWith('.tsx')
      ) {
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

          const existingEntry = changedLines.find((entry) => entry.file === currentFile)
          const lineNumbers = Array.from({ length: count }, (_, i) => startLine + i)

          if (existingEntry) {
            existingEntry.lines.push(...lineNumbers)
          } else {
            changedLines.push({
              file: currentFile.replace('src/', ''),
              lines: lineNumbers,
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

async function findAffectedToNodes(
  nodes: Results['nodes'],
  callGraph: string[],
  changedLines: ChangedLine[],
): Promise<any[]> {
  const affectedNodes = new Set<any>()

  const toNodes = nodes.filter(
    (node) =>
      node.type === 'NamedExport' ||
      node.type === 'GlobalVarWrite' ||
      node.type === 'WebStorageWrite' ||
      node.type === 'EventEmit',
  )

  for (const callGraphNode of callGraph) {
    const path = callGraphNode[0]
    const locations = path.split('->')
    const toNode = toNodes.find(
      (node) =>
        `${node.relativePath}:${node.startLine}:${node.startColumn}:${node.endLine}:${node.endColumn}` ===
        locations[0],
    )

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
          if (
            changedLine.lines.some(
              (line) => line >= parseInt(startLine) && line <= parseInt(endLine),
            )
          ) {
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
