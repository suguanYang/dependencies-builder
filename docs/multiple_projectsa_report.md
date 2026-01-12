# Multi-Project Report Implementation Plan

## Overview

This document describes the implementation plan for supporting multi-project reports in monorepos. When generating a report, the CLI will automatically detect all projects affected by changed files and produce a single combined report.

## Current Behavior

1. User provides `projectAddr`, `projectName`, `branch`, `targetBranch`
2. CLI checks out repo, finds the specific package
3. CLI generates report for that single project
4. Single report uploaded

## New Behavior

1. User provides only `projectAddr`, `branch`, `targetBranch` (projectName is **optional**)
2. CLI checks out repo, gets `changedLines` from git diff
3. CLI maps `changedLines` → affected `package.json` files → `projectNames`
4. CLI collects `affectedToNodes` and `changedContext` from **all affected projects**
5. CLI **merges** all results into a **single combined report**
6. Single combined report uploaded

## Key Changes

### Breaking Change: Remove `targetVersion` from Report Result

The `targetVersion` field is **removed** from the report result. Previously, the web client used this to display a warning when `version !== targetVersion`. 

**New approach:** Each `affectedToNode` already contains its own `version` field. The web client should now check versions per-node for more precise version mismatch detection. This is especially important for multi-project reports where different projects may have different versions.

```typescript
// Old ReportResult
interface ReportResult {
  affectedToNodes: LocalNode[]
  version: string
  targetVersion: string  // REMOVED
  affecatedConnections: Connection[]
  impactAnalysis?: ImpactReport | null
}

// New ReportResult  
interface ReportResult {
  affectedToNodes: LocalNode[]  // Each node has node.version
  version: string               // Current branch version
  affecatedConnections: Connection[]
  impactAnalysis?: ImpactReport | null
}
```

**Web client update needed:** Replace `result.targetVersion` comparisons with per-node version checks using `affectedToNode.version`.

---

### Breaking Change: Remove `projectName` from `analyzeImpact`

The `projectName` parameter is **removed** from `ImpactAnalysisInput`. Since each `toNode` already contains its own `projectName` field, the LLM context template now uses `toNode.projectName` directly. This enables proper multi-project support where different nodes may belong to different projects.

```typescript
// Old ImpactAnalysisInput
interface ImpactAnalysisInput {
  projectName: string  // REMOVED
  projectAddr: string
  sourceBranch: string
  // ...
}

// New ImpactAnalysisInput
interface ImpactAnalysisInput {
  projectAddr: string
  sourceBranch: string
  // ... (projectName is obtained from each toNode)
}
```

---

### 1. Server-Side Validation

**File:** `packages/server/src/api/routes/actions.ts`

```typescript
// For report type: projectName is optional
if (actionData.type === 'report') {
  if (!actionData.projectAddr || !actionData.branch || !actionData.targetBranch) {
    reply.code(400).send({
      error: 'Validation failed',
      details: 'projectAddr, branch, and targetBranch are required for report',
    })
    return
  }
  // projectName is optional - CLI will auto-detect from changed files
}

// For static_analysis: all fields required
if (actionData.type === 'static_analysis') {
  if (!actionData.projectAddr || !actionData.projectName || !actionData.branch) {
    reply.code(400).send({
      error: 'Validation failed',
      details: 'projectAddr, projectName, and branch are required for static_analysis',
    })
    return
  }
  // Validate project exists
  const project = await repository.getProjectByName(actionData.projectName)
  if (!project) {
    reply.code(404).send({
      error: 'Project not found',
      details: `Project '${actionData.projectName}' must be registered before analysis`,
    })
    return
  }
}
```

### 2. CLI Service Updates

**File:** `packages/server/src/services/cli-service.ts`

Update `getCLICommand` for report type - `--name` is now optional:

```typescript
case 'report':
  const reportArgs = [
    'npx',
    '@dms/cli',
    'report',
    actionData.projectAddr,
    '--branch',
    actionData.branch,
    '--target-branch',
    actionData.targetBranch!,
    '--action-id',
    actionId,
    '--verbose',
  ]
  
  // projectName is optional - only add if provided
  if (actionData.projectName) {
    reportArgs.push('--name', actionData.projectName)
  }
  
  if (actionData.ignoreCallGraph) {
    reportArgs.push('--ignore-call-graph')
  }
  
  return reportArgs
```

### 3. CLI Report Command

**File:** `packages/cli/src/commands/report.ts`

#### New Function: Find Affected Projects

```typescript
interface AffectedProject {
  name: string
  directory: string
}

/**
 * Find all projects affected by changed files.
 * Maps changed file paths to their containing package.json files.
 */
function findAffectedProjects(
  repoDir: string,
  changedLines: ChangedLine[]
): AffectedProject[] {
  const affectedProjects = new Map<string, string>()
  
  for (const change of changedLines) {
    // Walk up from the changed file to find package.json
    let dir = path.dirname(path.join(repoDir, change.file))
    
    while (dir.startsWith(repoDir) && dir !== repoDir) {
      const pkgPath = path.join(dir, 'package.json')
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
          if (pkg.name && !affectedProjects.has(pkg.name)) {
            affectedProjects.set(pkg.name, dir)
          }
        } catch { /* skip invalid package.json */ }
        break
      }
      dir = path.dirname(dir)
    }
  }
  
  return Array.from(affectedProjects, ([name, directory]) => ({ name, directory }))
}
```

#### Updated generateReport Function

```typescript
export async function generateReport(): Promise<void> {
  debug('Starting multi-project report generation')
  
  const ctx = getContext()
  const targetBranch = ctx.getTargetBranch()!
  const repoDir = ctx.getRepositoryDir()
  
  try {
    await checkoutRepository()
    debug('Repository checked out')
    
    const workingDir = ctx.getWorkingDirectory()
    
    // Get changed lines first (before knowing which projects)
    debug('Getting diff with target branch: %s', targetBranch)
    const changedLines = await getDiffChangedLines(workingDir, targetBranch)
    debug('Changed lines across repo: %d files', changedLines.length)
    
    // Find all affected projects from changed files
    const affectedProjects = findAffectedProjects(repoDir, changedLines)
    debug('Affected projects: %s', affectedProjects.map(p => p.name).join(', '))
    
    if (affectedProjects.length === 0) {
      debug('No affected projects found in changed files')
      await uploadReport({ 
        affectedToNodes: [], 
        version: '', 
        affecatedConnections: [],
      })
      return
    }
    
    // Collect results from all affected projects
    const allAffectedToNodes: LocalNode[] = []
    const allChangedContext = new Map<string, string[]>()
    let latestVersion = ''
    
    for (const project of affectedProjects) {
      debug('Processing project: %s', project.name)
      
      try {
        // Get analysis results for this project
        const results = getAnalysisResultsForProject(targetBranch, project.name)
        debug('Project %s: %d nodes', project.name, results.nodes.length)
        
        // Filter changed lines to only this project's files
        const projectRelativePath = path.relative(repoDir, project.directory)
        const projectChanges = changedLines.filter(cl => 
          cl.file.startsWith(projectRelativePath + '/') || cl.file.startsWith(projectRelativePath)
        )
        
        // Find affected nodes for this project
        const { nodes: affectedToNodes, context: changedContext } = await findAffectedToNodes(
          results.nodes,
          results.callGraph,
          projectChanges,
        )
        
        debug('Project %s: %d affected nodes', project.name, affectedToNodes.length)
        
        // Merge into combined results
        allAffectedToNodes.push(...affectedToNodes)
        
        for (const [nodeId, contexts] of changedContext) {
          if (allChangedContext.has(nodeId)) {
            allChangedContext.get(nodeId)!.push(...contexts)
          } else {
            allChangedContext.set(nodeId, [...contexts])
          }
        }
        
        // Track version (from current branch analysis)
        latestVersion = results.version || latestVersion
        
      } catch (error) {
        debug('Failed to process project %s: %o', project.name, error)
        // Continue with other projects
      }
    }
    
    debug('Total affected nodes across all projects: %d', allAffectedToNodes.length)
    
    // Get connections for all affected nodes
    const affecatedConnections = (
      await Promise.all(allAffectedToNodes.map(node => getConnectionsByToNode(node)))
    ).flat()
    
    // Perform LLM-based impact analysis on combined results
    let impactAnalysis: ImpactReport | null = null
    try {
      if (allAffectedToNodes.length > 0) {
        debug('Starting LLM-based impact analysis on combined results...')
        impactAnalysis = await analyzeImpact({
          projectAddr: ctx.getRepository(),
          sourceBranch: ctx.getBranch(),
          targetBranch,
          affectedToNodes: allAffectedToNodes,
          affectedConnections: affecatedConnections,
          changedContext: allChangedContext,
        })
      }
    } catch (error) {
      debug('LLM analysis failed: %o', error)
    }
    
    // Create single combined report
    // Note: targetVersion is removed - each affectedToNode has its own version field
    // for more precise version mismatch checking on the client side
    const reportResult: ReportResult = {
      affectedToNodes: allAffectedToNodes,
      version: latestVersion,
      affecatedConnections,
      impactAnalysis,
    }
    
    // Upload single combined report
    await uploadReport(reportResult)
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

/**
 * Get analysis results for a specific project
 */
function getAnalysisResultsForProject(targetBranch: string, projectName: string): Results & {
  callGraph: [string, string][]
  version: string
} {
  const ctx = getContext()
  const resFile = path.join(ctx.getLocalDirectory(targetBranch), projectName, 'analysis-results.json')
  
  // Fallback to old path structure
  if (!existsSync(resFile)) {
    const oldPath = path.join(
      process.env.DMS_LOCAL_DIR || homedir(),
      '.dms',
      path2name(ctx.getRepository()),
      path2name(targetBranch),
      path2name(projectName),
      'analysis-results.json'
    )
    if (existsSync(oldPath)) {
      return JSON.parse(readFileSync(oldPath, 'utf-8'))
    }
    throw new Error(`Analysis results for project '${projectName}' not found`)
  }
  
  return JSON.parse(readFileSync(resFile, 'utf-8'))
}
```

### 4. Context Changes

**File:** `packages/cli/src/context.ts`

Make `name` optional for report command:

```typescript
export interface AnalyzeOptions {
  branch: string
  type?: REPO_TYPE
  targetBranch?: string
  actionId?: string
  ignoreCallGraph?: boolean
  repository: string
  name?: string  // Optional for report command
}
```

### 5. Frontend Changes

**File:** `packages/web/src/app/(app)/actions/page.tsx`

Update Zod schema:

```typescript
const actionSchema = z.object({
  projectName: z.string().optional(),
  projectAddr: z.string().min(1, 'Project address is required'),
  branch: z.string().min(1, 'Branch is required'),
  type: z.enum(['static_analysis', 'report']),
  targetBranch: z.string().optional(),
  ignoreCallGraph: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'static_analysis' && !data.projectName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Project name is required for static analysis',
      path: ['projectName'],
    })
  }
  if (data.type === 'report' && !data.targetBranch) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Target branch is required for report',
      path: ['targetBranch'],
    })
  }
})
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Git Repository (Monorepo)                    │
├─────────────────────────────────────────────────────────────────┤
│  packages/                                                       │
│  ├─ project-a/                                                  │
│  │  ├─ package.json  ← name: "@org/project-a"                   │
│  │  └─ src/                                                     │
│  │     └─ index.ts   ← CHANGED                                  │
│  ├─ project-b/                                                  │
│  │  ├─ package.json  ← name: "@org/project-b"                   │
│  │  └─ src/                                                     │
│  │     └─ utils.ts   ← CHANGED                                  │
│  └─ project-c/                                                  │
│     ├─ package.json  ← name: "@org/project-c"                   │
│     └─ src/          ← NOT CHANGED                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. Get Changed Lines                         │
│  git diff targetBranch...HEAD                                   │
├─────────────────────────────────────────────────────────────────┤
│  - packages/project-a/src/index.ts                              │
│  - packages/project-b/src/utils.ts                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               2. Find Affected Projects                         │
│  Map changed files → nearest package.json → projectName         │
├─────────────────────────────────────────────────────────────────┤
│  Affected: [@org/project-a, @org/project-b]                     │
│  Not affected: [@org/project-c]                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│          3. Collect from Each Affected Project                  │
├─────────────────────────────────────────────────────────────────┤
│  For @org/project-a:                                            │
│    - Load analysis-results.json                                 │
│    - Filter changedLines for project-a files                    │
│    - findAffectedToNodes() → [node1, node2]                     │
│    - changedContext → {node1: [...], node2: [...]}              │
│                                                                 │
│  For @org/project-b:                                            │
│    - Load analysis-results.json                                 │
│    - Filter changedLines for project-b files                    │
│    - findAffectedToNodes() → [node3]                            │
│    - changedContext → {node3: [...]}                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              4. Merge All Results                               │
├─────────────────────────────────────────────────────────────────┤
│  allAffectedToNodes: [node1, node2, node3]                      │
│  allChangedContext: {node1: [...], node2: [...], node3: [...]}  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           5. Continue Normal Report Flow                        │
├─────────────────────────────────────────────────────────────────┤
│  - getConnectionsByToNode() for all nodes                       │
│  - analyzeImpact() with combined data                           │
│  - uploadReport() - SINGLE combined report                      │
└─────────────────────────────────────────────────────────────────┘
```

## Summary

| Aspect | Single Project (Old) | Multi-Project (New) |
|--------|---------------------|---------------------|
| projectName | Required | Optional |
| Detection | Manual | Auto from changedLines |
| Processing | 1 project | N affected projects |
| Result merge | N/A | Merge affectedToNodes + changedContext |
| Upload | 1 call | 1 call (combined) |
| LLM analysis | 1 project | Combined data |
