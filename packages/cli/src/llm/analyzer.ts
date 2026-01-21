import type { Connection, LocalNode } from '../server-types'
import { loadLLMConfig, validateLLMConfig } from './config'
import { initMCPClient, closeMCPClient } from './mcp-client'
import { invokeLLMAgent } from './agent'
import debug, { error } from '../utils/debug'
import { generateNodeId } from '../utils/node-id'
import { calculateBatches, type ContextItem, type ContextBatch } from './token-budget'
import { acquireRateLimit } from './rate-limiter'

/**
 * Impact analysis report structure
 */
export interface ImpactReport {
  /** 项目整体影响程度, 取所有受影响项目中最高的影响程度 */
  level: 'safe' | 'low' | 'medium' | 'high'
  /** Whether the analysis was successful */
  success: boolean
  /** Summary of all code changes made in this branch, one entry per changed file */
  summary: string[]
  /** Per-project impact analysis with specific suggestions */
  affectedProjects?: Array<{
    projectName: string
    impacts: string[]
    level: 'safe' | 'low' | 'medium' | 'high'
    suggestions: string[]
  }>
  /** Additional messages or error details */
  message: string
}

/**
 * Input data for impact analysis
 */
export interface ImpactAnalysisInput {
  projectAddr: string
  sourceBranch: string
  targetBranch: string
  affectedToNodes: LocalNode[]
  affectedConnections: Connection[]
  changedContext?: Map<string, string[]>
}

/**
 * Context batch with formatted context string
 */
interface FormattedContextBatch {
  context: string
  items: ContextItem[]
}

/**
 * Analyze the impact of changes using LLM
 * @param input Analysis input data from report generation
 * @returns Impact report or null if analysis is disabled/failed
 */
export async function analyzeImpact(input: ImpactAnalysisInput): Promise<ImpactReport | null> {
  const config = loadLLMConfig()

  if (!config.enabled) {
    debug(
      'LLM integration is not enabled (missing environment variables), skipping impact analysis',
    )
    return null
  }

  try {
    validateLLMConfig(config)
  } catch (error) {
    debug('LLM configuration validation failed: %o', error)
    return null
  }

  try {
    debug('Starting LLM-based impact analysis with dynamic context building...')

    // Fetch GitRepo configurations for all affected projects
    debug('Fetching GitRepo configurations for affected projects...')
    const { getGitRepoByHost, parseGitUrl } = await import('../api')

    // Collect project data from current project and all affected projects
    const projectData: Array<{ projectId: string; host: string }> = []

    // Add main project
    const mainParsed = parseGitUrl(input.projectAddr)
    projectData.push({ projectId: mainParsed.projectId, host: mainParsed.host })

    // Add all dependent projects from affectedConnections
    for (const conn of input.affectedConnections) {
      const projectAddr = conn.fromNode?.project?.addr
      if (projectAddr) {
        try {
          const parsed = parseGitUrl(projectAddr)
          projectData.push({ projectId: parsed.projectId, host: parsed.host })
        } catch (err) {
          debug('Failed to parse project address %s: %o', projectAddr, err)
        }
      }
    }

    // Build projectId -> GitRepoConfig map with host caching
    const projectIdToConfigMap = new Map<string, import('../api').GitRepoConfig>()
    const hostCache = new Map<string, import('../api').GitRepoConfig>()
    const failedHosts: string[] = []

    for (const { projectId, host } of projectData) {
      // Check cache first
      let config = hostCache.get(host)

      if (!config) {
        // Fetch from server if not cached
        try {
          config = await getGitRepoByHost(host)
          hostCache.set(host, config)
          debug('Fetched GitRepo config for host %s: API URL = %s', host, config.apiUrl)
        } catch (err) {
          if (!failedHosts.includes(host)) {
            failedHosts.push(host)
          }
          debug('Failed to fetch GitRepo config for host %s: %o', host, err)
          continue
        }
      }

      projectIdToConfigMap.set(projectId, config)
    }

    // Throw error if any GitRepo config is missing (no fallback)
    if (failedHosts.length > 0) {
      throw new Error(
        `GitRepo configuration not found for the following hosts: ${failedHosts.join(', ')}. ` +
          `Please configure them in the admin panel first.`,
      )
    }

    if (projectIdToConfigMap.size === 0) {
      throw new Error('No GitRepo configurations found for any affected projects')
    }

    debug('Built projectId -> GitRepoConfig map with %d entries', projectIdToConfigMap.size)

    // Initialize MCP client with projectId -> GitRepoConfig map
    await initMCPClient(projectIdToConfigMap)

    // Prepare context batches (handles token budget automatically)
    const batches = await prepareContextBatches(input)
    const instruction = prepareInstruction()

    if (batches.length === 0) {
      throw new Error('No valid context batches to analyze')
    }

    debug(`Processing ${batches.length} batch(es) with rate limiting...`)

    // Fire all batch requests respecting concurrent rate limits
    // Each batch acquires a lease before making request, releases when done
    const results: ImpactReport[] = await Promise.all(
      batches.map(async (batch, index) => {
        let releaseLease: (() => Promise<void>) | null = null

        try {
          // Acquire a rate limit lease before making request
          releaseLease = await acquireRateLimit()
          debug(`Starting batch ${index + 1}/${batches.length}...`)

          const result = await invokeLLMAgent(batch.context, instruction, config.llm)
          const report = parseAgentResult(result)
          debug(`Batch ${index + 1}/${batches.length} completed successfully`)
          return report
        } catch (error) {
          debug(`Batch ${index + 1}/${batches.length} failed: %o`, error)
          // Return a partial error report for this batch
          return {
            success: false,
            level: 'medium' as const,
            summary: [`Batch ${index + 1} failed to analyze`],
            message: error instanceof Error ? error.message : String(error),
          }
        } finally {
          // Always release the lease if we acquired one
          if (releaseLease) {
            try {
              await releaseLease()
            } catch (releaseError) {
              debug(`Failed to release rate limit lease for batch ${index + 1}: %o`, releaseError)
            }
          }
        }
      }),
    )

    // Merge results from all batches
    const mergedReport = mergeImpactReports(results)

    debug('All batches completed and merged')
    return mergedReport
  } catch (error) {
    debug('Impact analysis failed: %o', error)
    return {
      success: false,
      level: 'medium',
      summary: ['Failed to analyze impact'],
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    // Always close the MCP client
    await closeMCPClient()
  }
}

const getProjectIDFromRepositoryAddr = (addr: string) => {
  try {
    const url = new URL(addr)

    return url.pathname.substring(1, url.pathname.length).replace('.git', '')
  } catch (error) {
    throw new Error(`Failed to extract project ID from repository address: ${addr}`, {
      cause: error,
    })
  }
}

/**
 * Prepare context batches for the LLM
 * Implements token budget management with automatic batching
 */
async function prepareContextBatches(input: ImpactAnalysisInput): Promise<FormattedContextBatch[]> {
  const { getProjectByName } = await import('../api')

  // Validate input project address
  if (!input.projectAddr) {
    throw new Error('Project address is required for LLM analysis')
  }

  // Validate branches
  if (!input.sourceBranch || !input.targetBranch) {
    throw new Error('Source and target branches are required for LLM analysis')
  }

  // Validate affected nodes
  for (const conn of input.affectedConnections) {
    const fromNode = conn.fromNode
    const toNode = conn.toNode

    // Validate dependent node data
    if (!fromNode?.projectName)
      throw new Error(`Missing project name for dependent node: ${fromNode?.name}`)
    if (!fromNode?.relativePath)
      throw new Error(`Missing file path for dependent node: ${fromNode?.name}`)
    if (!fromNode?.name) throw new Error(`Missing name for dependent node`)
    if (fromNode?.startLine === undefined)
      throw new Error(`Missing start line for dependent node: ${fromNode?.name}`)

    // Validate dependency node data
    if (!toNode?.relativePath)
      throw new Error(`Missing file path for dependency node: ${toNode?.name}`)
    if (!toNode?.name) throw new Error(`Missing name for dependency node`)
    if (toNode?.startLine === undefined)
      throw new Error(`Missing start line for dependency node: ${toNode?.name}`)
  }

  // Get unique project names and fetch their addresses
  const uniqueProjectNames = [
    ...new Set(
      input.affectedConnections
        .map((conn) => conn.fromNode?.projectName)
        .filter((name): name is string => !!name),
    ),
  ]

  if (uniqueProjectNames.length === 0) {
    throw new Error('No affected projects found - cannot perform LLM analysis')
  }

  // Fetch project addresses in parallel
  const projectAddressMap = new Map<string, string>()
  const failedProjects: string[] = []

  await Promise.all(
    uniqueProjectNames.map(async (projectName) => {
      try {
        const project = await getProjectByName(projectName)
        if (project?.addr) {
          projectAddressMap.set(projectName, project.addr)
        } else {
          failedProjects.push(projectName)
          error(`Project ${projectName} has no address`)
        }
      } catch (err) {
        failedProjects.push(projectName)
        error(`Failed to fetch project address for ${projectName}: %o`, err)
      }
    }),
  )

  // Throw if too many projects failed to resolve
  if (failedProjects.length > 0) {
    throw new Error(
      `Failed to resolve repository addresses for ` + `Projects: ${failedProjects.join(', ')}`,
    )
  }

  // Prepare impact data with project IDs
  const impactData = input.affectedConnections.map((conn) => {
    const fromNode = conn.fromNode
    const toNode = conn.toNode

    const projectAddr = fromNode?.projectName
      ? projectAddressMap.get(fromNode.projectName)
      : undefined

    // Extract project ID from repository address
    const projectID = projectAddr ? getProjectIDFromRepositoryAddr(projectAddr) : undefined

    if (!projectID) {
      throw new Error(`Failed to resolve project ID for dependent project: ${fromNode.projectName}`)
    }

    // Get changed context for the 'toNode' (dependency in the current project)
    const toNodeId = generateNodeId(toNode)
    const changedLines = input.changedContext?.get(toNodeId)

    return {
      fromNode,
      toNode,
      projectID,
      changedLines,
    }
  })

  // Get current project ID (needed for fetching dependent code files)
  const currentProjectID = getProjectIDFromRepositoryAddr(input.projectAddr)
  if (!currentProjectID) {
    throw new Error(`Failed to extract project ID from repository address: ${input.projectAddr}`)
  }

  // Fetch both impacted and dependent code file contents using GitLab MCP
  debug('Fetching %d impacted and dependent code files using GitLab MCP...', impactData.length * 2)
  const mcpClient = await import('./mcp-client').then((m) => m.getMCPClient())
  const tools = await mcpClient.getTools()
  const getFileContentsTool = tools.find((t) => t.name === 'get_file_contents')

  if (!getFileContentsTool) {
    throw new Error('get_file_contents tool not found in MCP client')
  }

  // Cache to avoid duplicate file fetches - Key: `${project_id}:${file_path}:${ref}`
  const fileContentCache = new Map<string, any>()

  /**
   * Fetch file content with caching
   */
  const fetchFileContent = async (projectId: string, filePath: string, ref: string) => {
    const cacheKey = `${projectId}:${filePath}:${ref}`

    if (fileContentCache.has(cacheKey)) {
      debug('Cache hit for %s', cacheKey)
      return fileContentCache.get(cacheKey)
    }

    debug('Fetching file content: %s', cacheKey)
    const content = await getFileContentsTool
      .invoke({
        project_id: projectId,
        file_path: filePath,
        ref,
      })
      .catch((err) => {
        error('Failed to fetch %s: %o', cacheKey, err)
        return `[Error fetching file: ${err instanceof Error ? err.message : String(err)}]`
      })

    fileContentCache.set(cacheKey, content)
    return content
  }

  // Serialize requests to avoid MCP session concurrency issues
  const impactsWithContent: ContextItem[] = []

  for (const item of impactData) {
    const { fromNode, toNode, projectID, changedLines } = item

    // Fetch both files serially (avoiding concurrent requests on same session)
    const impactedFileContent = await fetchFileContent(
      projectID,
      fromNode.relativePath,
      fromNode.branch,
    )

    const dependentFileContent = await fetchFileContent(
      currentProjectID,
      toNode.relativePath,
      input.sourceBranch,
    )

    debug(
      'Fetched files for %s -> %s (%d + %d bytes)',
      fromNode.projectName,
      toNode.relativePath,
      typeof impactedFileContent === 'string' ? impactedFileContent.length : 0,
      typeof dependentFileContent === 'string' ? dependentFileContent.length : 0,
    )

    // Extract actual content from GitLab MCP response
    const extractContent = (fileContent: any): string => {
      if (typeof fileContent === 'string') {
        // If already a string, check if it's an error message
        if (fileContent.startsWith('[Error fetching file:')) {
          return fileContent
        }
        // Try to parse as JSON in case it's stringified
        try {
          const parsed = JSON.parse(fileContent)
          return parsed.content || fileContent
        } catch {
          return fileContent
        }
      }
      // If it's an object, extract the content field
      if (fileContent && typeof fileContent === 'object' && 'content' in fileContent) {
        return fileContent.content
      }
      // Fallback to stringifying
      return JSON.stringify(fileContent)
    }

    const impactedContent = extractContent(impactedFileContent)
    const dependentContent = extractContent(dependentFileContent)

    impactsWithContent.push({
      ...item,
      impactedCodeContent: impactedContent,
      dependentCodeContent: dependentContent,
    })
  }

  debug(
    'Completed fetching - Total: %d files, Unique: %d, Cache hits: %d (%.0f%% reduction)',
    impactData.length * 2,
    fileContentCache.size,
    impactData.length * 2 - fileContentCache.size,
    fileContentCache.size > 0
      ? ((impactData.length * 2 - fileContentCache.size) / (impactData.length * 2)) * 100
      : 0,
  )

  // Only filter out entries with no changes at all (no fragile whitespace filtering)
  const validImpacts = impactsWithContent.filter((item) => {
    return item.changedLines && item.changedLines.length > 0
  })

  // Validate we still have nodes after filtering
  if (validImpacts.length === 0) {
    throw new Error('No valid affected nodes after filtering - cannot perform LLM analysis')
  }

  // Get diff content (concatenate all changed lines for token calculation)
  const diffContent = validImpacts
    .map((item) => item.changedLines?.join('\n') || '')
    .filter((s) => s.length > 0)
    .join('\n\n')

  // Calculate batches using token budget manager
  const contextBatches = calculateBatches(diffContent, validImpacts)

  // Format each batch into context strings
  const formattedBatches: FormattedContextBatch[] = contextBatches.map((batch) => {
    const analysisTasks = batch.items.map((item) => {
      const {
        fromNode,
        toNode,
        projectID,
        changedLines,
        impactedCodeContent,
        dependentCodeContent,
      } = item

      // Format changed code diff
      let diffContent = ''
      if (changedLines && changedLines.length > 0) {
        diffContent = changedLines.join('\n')
      }

      // Format dependent file content with line numbers
      let dependentFileContent = ''
      if (dependentCodeContent) {
        // Check if it's an error message
        if (dependentCodeContent.startsWith('[Error fetching file:')) {
          dependentFileContent = `    <SYSTEM_ERROR>${dependentCodeContent}</SYSTEM_ERROR>`
        } else {
          const lines = dependentCodeContent.split('\n')
          const numberedLines = lines
            .map((line, idx) => {
              const lineNum = (idx + 1).toString().padStart(4, ' ')
              return `    ${lineNum}: ${line}`
            })
            .join('\n')
          dependentFileContent = numberedLines
        }
      }

      // Format impacted file content with line numbers
      let impactedFileContent = ''
      if (impactedCodeContent) {
        // Check if it's an error message
        if (impactedCodeContent.startsWith('[Error fetching file:')) {
          impactedFileContent = `    <SYSTEM_ERROR>${impactedCodeContent}</SYSTEM_ERROR>`
        } else {
          const lines = impactedCodeContent.split('\n')
          const numberedLines = lines
            .map((line, idx) => {
              const lineNum = (idx + 1).toString().padStart(4, ' ')
              return `    ${lineNum}: ${line}`
            })
            .join('\n')
          impactedFileContent = numberedLines
        }
      }

      return `<analysis_task>
  <dependency_metadata>
    <provider_project_name>${toNode.projectName}</provider_project_name>
    <provider_project_id>${currentProjectID}</provider_project_id>
    <provider_branch>${input.sourceBranch}</provider_branch>
    <provider_file_path>${toNode.relativePath}</provider_file_path>
    <provider_line_number>${toNode.startLine}</provider_line_number>
    
    <consumer_project_name>${fromNode.projectName}</consumer_project_name>
    <consumer_project_id>${projectID}</consumer_project_id>
    <consumer_branch>${fromNode.branch}</consumer_branch>
    <consumer_file_path>${fromNode.relativePath}</consumer_file_path>
    <consumer_usage_line_number>${fromNode.startLine}</consumer_usage_line_number>
    <dependency_type>${toNode.type || 'Unknown'}</dependency_type>
  </dependency_metadata>

  <source_change_diff>
    <!-- The code changing in the provider (dependency) -->
${diffContent
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  </source_change_diff>

  <provider_file_content>
    <!-- The COMPLETE file content from the provider project (with line numbers) -->
${dependentFileContent}
  </provider_file_content>

  <consumer_file_content>
    <!-- The COMPLETE file content from the consumer project (with line numbers) -->
${impactedFileContent}
  </consumer_file_content>
</analysis_task>`
    })

    const contextString = `
Source Branch: ${input.sourceBranch}
Target Branch: ${input.targetBranch}

Total Analysis Tasks: ${analysisTasks.length}

${analysisTasks.join('\n\n')}
`.trim()

    return {
      context: contextString,
      items: batch.items,
    }
  })

  return formattedBatches
}

/**
 * Merge multiple impact reports into a single report
 */
function mergeImpactReports(reports: ImpactReport[]): ImpactReport {
  if (reports.length === 0) {
    return {
      success: false,
      level: 'medium',
      summary: ['No reports to merge'],
      message: 'No analysis results available',
    }
  }

  if (reports.length === 1) {
    return reports[0]
  }

  // Determine overall success (all must succeed)
  const success = reports.every((r) => r.success)

  // Take the highest severity level
  const levelPriority: Record<string, number> = { safe: 0, low: 1, medium: 2, high: 3 }
  const highestLevel = reports.reduce(
    (max, r) => {
      return levelPriority[r.level] > levelPriority[max] ? r.level : max
    },
    'safe' as 'safe' | 'low' | 'medium' | 'high',
  )

  // Merge summaries by file path, keeping the longest description for each file
  const summaryMap = new Map<string, string>()
  for (const report of reports) {
    for (const entry of report.summary) {
      // Parse "filepath: description" format
      const colonIndex = entry.indexOf(':')
      if (colonIndex > 0) {
        const filePath = entry.substring(0, colonIndex).trim()
        const description = entry.substring(colonIndex + 1).trim()
        const existing = summaryMap.get(filePath)
        // Keep the longest description for each file
        if (!existing || description.length > existing.length) {
          summaryMap.set(filePath, description)
        }
      } else {
        // No colon found, use entire entry as key (fallback)
        if (!summaryMap.has(entry)) {
          summaryMap.set(entry, '')
        }
      }
    }
  }
  // Reconstruct summaries from map
  const summaries = Array.from(summaryMap.entries()).map(([filePath, description]) =>
    description ? `${filePath}: ${description}` : filePath,
  )

  // Merge affected projects by project name
  const projectMap = new Map<string, NonNullable<ImpactReport['affectedProjects']>[number]>()

  for (const report of reports) {
    if (report.affectedProjects) {
      for (const project of report.affectedProjects) {
        const existing = projectMap.get(project.projectName)
        if (existing) {
          // Merge impacts and suggestions
          existing.impacts.push(...project.impacts)
          existing.suggestions.push(...project.suggestions)
          // Take higher level
          if (levelPriority[project.level] > levelPriority[existing.level]) {
            existing.level = project.level
          }
        } else {
          projectMap.set(project.projectName, { ...project })
        }
      }
    }
  }

  const affectedProjects = Array.from(projectMap.values())

  // Merge messages
  const messages = reports.map((r) => r.message).filter((m) => m.length > 0)
  const message = messages.length > 0 ? messages.join(';\n ') : ''

  return {
    success,
    level: highestLevel,
    summary: summaries,
    affectedProjects: affectedProjects.length > 0 ? affectedProjects : undefined,
    message,
  }
}

/**
 * Prepare the instruction for the LLM agent
 */
function prepareInstruction(): string {
  return `
# Role
Your only job is to detect if a specific code change breaks a specific dependent file.
Your main analysis is reasoning about what the **changes impact**, the **relation** between the "Consumer Code" and the "Provider Change". Not just think the code itself.

# Analysis Philosophy
You have been provided with analysis tasks containing: "Provider Change" (Diff) and "Consumer Code" (Full File).
You must produce a **STABLE** and **FACTUAL** assessment. Do not guess.

# Workflow (Execute Strictly)

1.  **NOISE FILTER (Crucial)**:
    - Look at the \`<source_change_diff>\`.
    - Is it **ONLY** whitespace, formatting, comment updates, or variable renaming where the logic remains identical?
    - **The following are cosmetic (safe)**:
        - **Pure whitespace**: ONLY adding/removing spaces, tabs, or empty lines
          - Example: () => {} to () => { } is COSMETIC
          - Example: function(){} to function() {} is COSMETIC
        - **Pure comments/docs**: ONLY adding/removing comments or JSDoc (no code changes)
        - **Pure formatting**: ONLY line breaks, indentation changes (no code changes)
    - If YES -> Mark as \`level: "safe"\`, with explanation in \`impacts\`, and STOP. Do not analyze the consumer file.
    - **For PURELY cosmetic entries, output**:
      - impacts: ["仅格式化变更/注释更新，未修改代码逻辑"]
      - level: "safe"
      - suggestions: [null]

2.  **ANCHORING**:
    - If the change is logical, look at the \`<dependency_metadata>\` to find the \`<consumer_usage_line_number>\`.
    - Locate that exact line in the \`<consumer_file_content>\`.
    - Load all code that related to that line into your mental context.
    - Understand what the consumer code is trying to do at that specific line.

3.  **IMPACT SIMULATION**:
    - **Compilation Check**: Did the function signature (arguments, return type) in the Provider change? Will the Consumer code fail to compile?
    - **Runtime Check**: Did the behavior change (e.g., throwing error vs returning null, writing to localStorage vs sessionStorage)?
    - **Logic Check**: Specifically for the provided context, if some code was removed, does the Consumer code really depend on that code?
    - **CRITICAL: Distinguish import statements from actual usage**:
      - Pure ES6 import statements (e.g., import { foo } from 'bar') are NOT impacts by themselves
      - Imports are just declarations - they don't execute code (unless the module has side effects)
      - **Only flag the actual usage sites** where the imported function/variable is called/used
      - Example: If line 2 is [import { A }] and line 18 is [A()], only line 18 is impacted

4.  **MISSING DATA HANDLING**:
    - If the \`<consumer_file_content>\` or \`<provider_file_content>\` contains a \`<SYSTEM_ERROR>\` tag, you MUST output:
      - level: "medium"
      - impacts: ["无法获取文件内容，无法自动评估风险"]
      - suggestions: ["请人工排查文件: <file_path>"]

5. **COMPLEMENTARY**:
    - If the given context cannot determine the impact, try to grab more files that related to the code by calling related tools, like \`get_file_contents\`.

# Summary Field Requirements
- The summary field must be an ARRAY of strings, one entry per changed file
- Each entry should describe the changes in that specific file
- Format each entry as: "filename: description of changes"
- Example: ["src/utils/ajax/index.ts: 重命名methodA为methodAB，简化fetch参数", "src/infra/runtime.ts: 新增methodA函数文档说明资源版本管理协议", "src/utils/_import.ts: 调整错误处理逻辑，改为抛出异常而非记录日志"]
- Help users quickly understand which files changed and what changed in each file

# Terminology (Important for Chinese Output)
- Use concrete, code-focused terminology that developers and QA understand
- Translate 'provider' to '提供方', 'consumer' to '调用方'

# Output Format
**IMPORTANT: Please provide your analysis in CHINESE (中文). All text fields should be in Chinese.**

JSON Only. Language: Simplified Chinese.

\`\`\`json
{
  "success": true,
  "summary": [
    "path/to/file1.ts: 代码变更总结1",
    "path/to/file2.ts: 代码变更总结2",
    "path/to/file3.ts: 代码变更总结3"
  ],
  "level": "safe|low|medium|high", // 项目整体影响程度, 取所有受影响项目中最高的影响程度
  "affectedProjects": [
    {
      "projectName": "project-name-1",
      "impacts": [
        "path/to/file.ts第1行: [import { ... methodA ... } from 'xxx'] 代码引用，无影响", // if the impact is safe must Explain why it's safe
        "path/to/file.ts第123行: [if (window.__XXX__) {}] 具体影响描述，说明变更如何影响此处代码",
        "path/to/file.ts第456行: [methodA(<parameters>)] 另一处影响的具体描述"
      ],
      "level": "safe|low|medium|high", // chose the most severe level from impacts
      "suggestions": [
        null, // if level is safe, must output suggestions: [null]
        "该代码1的建议",
        "该代码2的建议"
      ]
    }
  ],
  "message": "附加上下文或错误详情" // 可选字段，用于提供额外的上下文或错误详情
}
\`\`\`

# Important Guidelines

**Analysis Strategy**:
- Use the \`<consumer_usage_line_number>\` to locate the exact usage in \`<consumer_file_content>\`
- Use the \`<provider_line_number>\` to understand what changed in \`<provider_file_content>\`
- Analyze how the \`<source_change_diff>\` affects the actual usage shown in the consumer code

**Impact Descriptions**:
- **CRITICAL**: Each impact description MUST include a code snippet showing the impacted code
- Format as: "文件xxx第N行: [code snippet] - 影响描述"
- Example: "文件src/app.tsx第116行: [methodA(<parameters>)] 该函数错误处理逻辑变化可能影响异常捕获"
- Provide specific line-number references when describing impacts

**Summary Field Requirements**:
- The summary field must be an ARRAY of strings, one entry per changed file
- Each entry should describe the changes in that specific file
- Format each entry as: "filename: description of changes"
- Example: ["src/utils/ajax/index.ts: 重命名methodA为methodAB，简化fetch参数"]
- Help users quickly understand which files changed and what changed in each file

**Impact Level Guidelines**:
- **high**: Breaking changes, API changes, critical functionality affected
- **medium**: Non-breaking changes with potential issues, deprecated features, or missing file data
- **low**: Minor changes, internal refactoring, documentation updates
- **safe**: Cosmetic changes, no impact on functionality (must explain why it's safe)
`
}

/**
 * Parse the agent's result and extract the impact report
 */
function parseAgentResult(result: string): ImpactReport {
  try {
    // Try to find JSON in the result (may be wrapped in ```json blocks)
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in agent response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate the structure
    if (
      typeof parsed.success !== 'boolean' ||
      !['safe', 'low', 'medium', 'high'].includes(parsed.level) ||
      !Array.isArray(parsed.summary) ||
      typeof parsed.message !== 'string'
    ) {
      throw new Error('Invalid impact report structure')
    }

    // Validate affectedProjects if present
    if (parsed.affectedProjects !== undefined) {
      if (!Array.isArray(parsed.affectedProjects)) {
        throw new Error('affectedProjects must be an array')
      }
      for (const project of parsed.affectedProjects) {
        if (
          typeof project.projectName !== 'string' ||
          !Array.isArray(project.impacts) ||
          !['safe', 'low', 'medium', 'high'].includes(project.level) ||
          !Array.isArray(project.suggestions)
        ) {
          throw new Error('Invalid affectedProjects structure')
        }
      }
    }

    return {
      success: parsed.success,
      level: parsed.level,
      summary: parsed.summary,
      affectedProjects: parsed.affectedProjects,
      message: parsed.message,
    } as ImpactReport
  } catch (err) {
    error('Failed to parse agent result: %o', err)
    // Return a fallback report
    return {
      success: false,
      level: 'medium',
      summary: ['Failed to parse analysis result'],
      message: `Parse error: ${err instanceof Error ? err.message : String(err)}. Raw result: ${result.substring(0, 200)}...`,
    }
  }
}
