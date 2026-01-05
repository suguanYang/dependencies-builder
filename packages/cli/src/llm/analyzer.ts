import type { Connection, Node } from '../server-types'
import { loadLLMConfig, validateLLMConfig } from './config'
import { createMCPClient } from './mcp-client'
import { invokeLLMAgent } from './agent'
import debug from '../utils/debug'

/**
 * Impact analysis report structure
 */
export interface ImpactReport {
  /** Whether the analysis was successful */
  success: boolean
  /** Summary of business-level impacts */
  impaction: string
  /** Severity level of the impact */
  level: 'low' | 'medium' | 'high'
  /** Overall suggestions for preventing the impact */
  suggestion: string | string[]
  /** Per-project impact analysis with specific suggestions */
  affectedProjects?: Array<{
    projectName: string
    impact: string
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
  affectedToNodes: Node[]
  affectedConnections: Connection[]
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
    validateLLMConfig(config, input.projectAddr)
  } catch (error) {
    debug('LLM configuration validation failed: %o', error)
    return null
  }

  try {
    debug('Starting LLM-based impact analysis...')

    // Initialize MCP client with automatic cleanup using 'using' syntax
    using mcpClient = await createMCPClient(config.gitlab)

    // Prepare context for the LLM
    const context = await prepareContext(input)
    const instruction = prepareInstruction()

    // Invoke the agent with the MCP client
    const result = await invokeLLMAgent(context, instruction, config.llm, mcpClient.getClient())

    // Parse the result
    const report = parseAgentResult(result)

    return report
    // MCP client will be automatically disposed here
  } catch (error) {
    debug('Impact analysis failed: %o', error)
    return {
      success: false,
      impaction: 'Failed to analyze impact',
      level: 'medium',
      suggestion: 'Manual review recommended',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

const getProjectIDFromRepositoryAddr = (addr: string) => {
  try {
    const url = new URL(addr)

    return url.pathname.substring(1, url.pathname.length).replace('.git', '')
  } catch (error) {
    throw new Error(`Failed to extract project ID from repository address: ${addr}`, { cause: error })
  }
}

/**
 * Prepare the context string for the LLM
 */
async function prepareContext(input: ImpactAnalysisInput): Promise<string> {
  const { getProjectByName } = await import('../api')

  // Validate input project address
  if (!input.projectAddr) {
    throw new Error('Project address is required for LLM analysis')
  }

  // Validate branches
  if (!input.sourceBranch || !input.targetBranch) {
    throw new Error('Source and target branches are required for LLM analysis')
  }

  // Get unique project names and fetch their addresses
  const uniqueProjectNames = [...new Set(
    input.affectedConnections
      .map(conn => conn.fromNode?.projectName)
      .filter((name): name is string => !!name)
  )]

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
          debug(`Project ${projectName} has no address`)
        }
      } catch (error) {
        failedProjects.push(projectName)
        debug(`Failed to fetch project address for ${projectName}: %o`, error)
      }
    })
  )

  // Throw if too many projects failed to resolve
  if (failedProjects.length > 0) {
    const failureRate = failedProjects.length / uniqueProjectNames.length
    if (failureRate > 0.5) {
      throw new Error(
        `Failed to resolve repository addresses for ${failedProjects.length}/${uniqueProjectNames.length} affected projects. ` +
        `Projects: ${failedProjects.join(', ')}`
      )
    } else {
      debug(`Warning: ${failedProjects.length} projects failed to resolve: ${failedProjects.join(', ')}`)
    }
  }

  const affectedFromNodes = input.affectedConnections
    .map((conn) => {
      const projectAddr = conn.fromNode?.projectName
        ? projectAddressMap.get(conn.fromNode.projectName)
        : undefined

      // Extract project ID from repository address
      const projectID = projectAddr ? getProjectIDFromRepositoryAddr(projectAddr) : undefined

      return {
        projectName: conn.fromNode?.projectName,
        projectAddr,
        projectID,
        name: conn.fromNode?.name,
        relativePath: conn.fromNode?.relativePath,
        startLine: conn.fromNode?.startLine,
        branch: conn.fromNode?.branch,
      }
    })
    // Filter out nodes with missing critical data
    .filter((node) => {
      const isValid = node.projectName && node.projectID && node.relativePath && node.name
      if (!isValid) {
        debug(`Filtering out invalid node: ${JSON.stringify(node)}`)
      }
      return isValid
    })

  // Validate we still have nodes after filtering
  if (affectedFromNodes.length === 0) {
    throw new Error('No valid affected nodes after filtering - cannot perform LLM analysis')
  }

  const projectID = getProjectIDFromRepositoryAddr(input.projectAddr)

  // Validate main project ID
  if (!projectID) {
    throw new Error(`Failed to extract project ID from repository address: ${input.projectAddr}`)
  }

  return `
Project ID: ${projectID}
Source Branch: ${input.sourceBranch}
Target Branch: ${input.targetBranch}

Affected From Nodes (${affectedFromNodes.length}):
${affectedFromNodes.map((node) => {
    const parts = [
      `Project: ${node.projectName}`,
      node.projectID ? `ID: ${node.projectID}` : null,
      `Path: ${node.relativePath}:${node.startLine}`,
      `Name: ${node.name}`,
      node.branch ? `Branch: ${node.branch}` : null,
    ].filter(Boolean)
    return `  - ${parts.join(', ')}`
  }).join('\n')}
`.trim()
}

/**
 * Prepare the instruction for the LLM agent
 */
function prepareInstruction(): string {
  return `You are reviewing a merge request and analyzing its potential impact on dependent projects.

**IMPORTANT: Please provide your analysis in CHINESE (中文). All text fields (impaction, impact, suggestions, message) should be in Chinese.**

**Your Task:**
Analyze the impact of these code changes on dependent projects and generate a JSON report WITH PER-PROJECT SUGGESTIONS.

**Context Provided:**
- Project ID (already extracted from repository URL - use this directly!)
- Source and target branches
- List of affected projects that depend on this code
  - Each project includes: name, **project ID (ID)**, file path, line number, and branch
  - **Project IDs are already extracted** - use them directly for GitLab API calls
- This dependency is comes from static analysis, mainly consists of these types: 1. ES6 import/export, 2. global variables, local storage, session storage read/write, 3. events. 4. URL parameters. The changed code may be a part of the call stack of the dependency

**Efficient Analysis Strategy:**
1. **Use the Project ID from context** (don't call list_projects for the main project)
2. Get the merge request ID for the given source and target branches by list_merge_requests(project_id: Project ID, source_branch: source_branch, target_branch: target_branch) *Do Not Specify The State of the MR*
3. Get the merge request diffs to see what actually changed by get_merge_request_diffs(project_id: Project ID, merge_request_iid: merge_request_iid, view: "inline")
4. **BATCH PROCESS**: For affected projects, **use their pre-extracted project IDs**
   - Each affected node has an "ID" field (e.g., "group/project")
   - **Use this ID directly** - no need to parse URLs or search by name
   - Make multiple tool calls in one response when possible
   - Focus on top 5-10 most critical projects if there are many
5. **BATCH PROCESS**: Get relevant file contents from affected projects in parallel
   - **NOTE**: File contents will have line numbers added (e.g., "   1: code here")
   - Use these line numbers to locate the exact code referenced in "Affected From Nodes"
6. **For EACH affected project**, analyze:
   - What specific functionality in that project is impacted
   - What actions that project needs to take
   - Reference specific line numbers when describing the impact
7. Generate your impact report with per-project suggestions **IN CHINESE**

**IMPORTANT Instructions:**
- The Project ID is already provided in the context - use it directly
- Do Not Diff the Changes commit by commit, get the diff at the MR level instead
- Process multiple projects at once (make several tool calls in one response)
- **Provide specific suggestions for EACH affected project**
- **All analysis text must be in CHINESE (中文)**
- If one project fails, continue with others
- Be efficient: avoid redundant tool calls
- Focus on the most impactful changes

**Output Format (JSON only, text content in CHINESE):**
\`\`\`json
{
  "success": true,
  "impaction": "整体业务层面的影响总结 (用中文)",
  "level": "low|medium|high",
  "suggestion": "整体建议或一般性指导 (用中文)",
  "affectedProjects": [
    {
      "projectName": "project-name-1",
      "impact": "该项目的具体影响 (用中文)",
      "suggestions": [
        "该项目的行动项 1 (用中文)",
        "该项目的行动项 2 (用中文)"
      ]
    },
    {
      "projectName": "project-name-2",
      "impact": "该项目的具体影响 (用中文)",
      "suggestions": [
        "该项目的行动项 1 (用中文)"
      ]
    }
  ],
  "message": "附加上下文或错误详情 (用中文)"
}
\`\`\`

**Impact Level Guidelines:**
- **high**: Breaking changes, API changes, critical functionality affected
- **medium**: Non-breaking changes with potential issues, deprecated features
- **low**: Minor changes, internal refactoring, documentation updates

Start your analysis now. Make tool calls efficiently in batches and provide SPECIFIC suggestions for each affected project **IN CHINESE (中文)**.`
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
      typeof parsed.impaction !== 'string' ||
      !['low', 'medium', 'high'].includes(parsed.level) ||
      (typeof parsed.suggestion !== 'string' && !Array.isArray(parsed.suggestion)) ||
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
          typeof project.impact !== 'string' ||
          !Array.isArray(project.suggestions)
        ) {
          throw new Error('Invalid affectedProjects structure')
        }
      }
    }

    // Normalize suggestion to string format (convert array to bullet points)
    let suggestion: string
    if (Array.isArray(parsed.suggestion)) {
      suggestion = parsed.suggestion.map((s: string) => `• ${s}`).join('\n')
    } else {
      suggestion = parsed.suggestion
    }

    return {
      success: parsed.success,
      impaction: parsed.impaction,
      level: parsed.level,
      suggestion,
      affectedProjects: parsed.affectedProjects,
      message: parsed.message,
    } as ImpactReport
  } catch (error) {
    debug('Failed to parse agent result: %o', error)
    // Return a fallback report
    return {
      success: false,
      impaction: 'Failed to parse analysis result',
      level: 'medium',
      suggestion: 'Manual review recommended',
      message: `Parse error: ${error instanceof Error ? error.message : String(error)}. Raw result: ${result.substring(0, 200)}...`,
    }
  }
}
