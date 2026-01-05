import type { Connection, Node } from '../server-types'
import { loadLLMConfig, validateLLMConfig } from './config'
import { initMCPClient, closeMCPClient } from './mcp-client'
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

    // Initialize MCP client
    await initMCPClient(config.gitlab)

    // Prepare context for the LLM
    const context = prepareContext(input)
    const instruction = prepareInstruction()

    // Invoke the agent
    const result = await invokeLLMAgent(context, instruction, config.llm)

    // Parse the result
    const report = parseAgentResult(result)

    return report
  } catch (error) {
    debug('Impact analysis failed: %o', error)
    return {
      success: false,
      impaction: 'Failed to analyze impact',
      level: 'medium',
      suggestion: 'Manual review recommended',
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    // Always close the MCP client
    await closeMCPClient()
  }
}

const getProjectIDFromRepositoryAddr = (addr: string) => {
  const url = new URL(addr)

  return url.pathname.substring(1, url.pathname.length).replace('.git', '')
}

/**
 * Prepare the context string for the LLM
 */
function prepareContext(input: ImpactAnalysisInput): string {
  const affectedFromNodes = input.affectedConnections.map((conn) => ({
    projectName: conn.fromNode?.projectName,
    name: conn.fromNode?.name,
    relativePath: conn.fromNode?.relativePath,
    startLine: conn.fromNode?.startLine,
    branch: conn.fromNode?.branch,
  }))

  const projectID = getProjectIDFromRepositoryAddr(input.projectAddr)

  return `
Project ID: ${projectID}
Source Branch: ${input.sourceBranch}
Target Branch: ${input.targetBranch}

Affected From Nodes (${affectedFromNodes.length}):
${affectedFromNodes.map((node) => `  - Project: ${node.projectName}, Path: ${node.relativePath}:${node.startLine}, Name: ${node.name}`).join('\n')}
`.trim()
}

/**
 * Prepare the instruction for the LLM agent
 */
function prepareInstruction(): string {
  return `You are reviewing a merge request and analyzing its potential impact on dependent projects.

**Your Task:**
Analyze the impact of these code changes on dependent projects and generate a JSON report WITH PER-PROJECT SUGGESTIONS.

**Context Provided:**
- Project ID (already extracted from repository URL - use this directly!)
- Source and target branches
- List of affected projects that depend on this code(this dependency is comes from static analysis, mainly consists of these types: 1. ES6 import/export, 2. global variables, local storage, session storage read/write, 3. events. 4. URL parameters. The changed code may be a part of the call stack of the dependency)

**Efficient Analysis Strategy:**
1. **Use the Project ID from context** (don't call list_projects for the main project)
2. Get the merge request ID for the given source and target branches
3. Get the merge request diffs to see what actually changed
4. **BATCH PROCESS**: For affected projects, get their project IDs
   - Make multiple tool calls in one response when possible
   - Focus on top 5-10 most critical projects if there are many
5. **BATCH PROCESS**: Get relevant file contents from affected projects in parallel
6. **For EACH affected project**, analyze:
   - What specific functionality in that project is impacted
   - What actions that project needs to take
7. Generate your impact report with per-project suggestions

**IMPORTANT Instructions:**
- The Project ID is already provided in the context - use it directly
- Process multiple projects at once (make several tool calls in one response)
- **Provide specific suggestions for EACH affected project**
- If one project fails, continue with others
- Be efficient: avoid redundant tool calls
- Focus on the most impactful changes

**Output Format (JSON only):**
\`\`\`json
{
  "success": true,
  "impaction": "Overall business-level impact summary",
  "level": "low|medium|high",
  "suggestion": "Overall recommendations or general guidance",
  "affectedProjects": [
    {
      "projectName": "project-name-1",
      "impact": "Specific impact on this project",
      "suggestions": [
        "Action item 1 for this project",
        "Action item 2 for this project"
      ]
    },
    {
      "projectName": "project-name-2",
      "impact": "Specific impact on this project",
      "suggestions": [
        "Action item 1 for this project"
      ]
    }
  ],
  "message": "Additional context or error details"
}
\`\`\`

**Impact Level Guidelines:**
- **high**: Breaking changes, API changes, critical functionality affected
- **medium**: Non-breaking changes with potential issues, deprecated features
- **low**: Minor changes, internal refactoring, documentation updates

Start your analysis now. Make tool calls efficiently in batches and provide SPECIFIC suggestions for each affected project.`
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
