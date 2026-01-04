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
  /** Suggestions for preventing the impact */
  suggestion: string
  /** Additional messages or error details */
  message: string
}

/**
 * Input data for impact analysis
 */
export interface ImpactAnalysisInput {
  projectName: string
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
    validateLLMConfig(config)
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

/**
 * Prepare the context string for the LLM
 */
function prepareContext(input: ImpactAnalysisInput): string {
  const affectedFromNodes = input.affectedConnections.map((conn) => ({
    projectName: conn.fromNode?.projectName || 'unknown',
    name: conn.fromNode?.name || 'unknown',
    relativePath: conn.fromNode?.relativePath || 'unknown',
    startLine: conn.fromNode?.startLine || 0,
    branch: conn.fromNode?.branch || 'unknown',
  }))

  return `
Project Name: ${input.projectName}
Source Branch: ${input.sourceBranch}
Target Branch: ${input.targetBranch}

Affected To Nodes (${input.affectedToNodes.length}):
${input.affectedToNodes.map((node) => `  - ${node.type}: ${node.name} at ${node.relativePath}:${node.startLine}`).join('\n')}

Affected From Nodes (${affectedFromNodes.length}):
${affectedFromNodes.map((node) => `  - Project: ${node.projectName}, Path: ${node.relativePath}:${node.startLine}, Name: ${node.name}`).join('\n')}
`.trim()
}

/**
 * Prepare the instruction for the LLM agent
 */
function prepareInstruction(): string {
  return `You are reviewing a merge request and analyzing its potential impact on dependent projects. Follow these steps:

1. Use gitlab_mcp to get the project_id by calling list_projects(search: project_name, per_page: 1)
2. Use gitlab_mcp to get the merge_request_id by calling list_merge_requests(project_id: project_id, target_branch: target_branch, source_branch: source_branch, per_page: 1)
3. Use gitlab_mcp to get the merge_request_content by calling get_merge_request_diffs(project_id: project_id, merge_request_iid: merge_request_id, view: "inline")
4. For each affected_from_node, use gitlab_mcp to get the project_id by calling list_projects(search: affected_from_node.projectName)
5. For each affected_from_node, use gitlab_mcp to get the file content by calling get_file_contents(project_id: affected_project_id, file_path: affected_from_node.relativePath, ref: affected_from_node.branch)

6. Based on the merge_request_content and affected_file_content, output a code change impact report in JSON format:
{
  "success": boolean,
  "impaction": string,  // Summary at business level for what functionalities may be impacted
  "level": "low" | "medium" | "high",  // Severity of the impact
  "suggestion": string,  // Suggestion on how to prevent the impact
  "message": string  // Other helpful information
}

7. If any step fails (e.g., failed to get project id), output the report with success: false and include the error in the message field.

IMPORTANT: Your final response must be ONLY the JSON object, no additional text.`
}

/**
 * Parse the agent's result and extract the impact report
 */
function parseAgentResult(result: string): ImpactReport {
  try {
    // Try to find JSON in the result
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
      typeof parsed.suggestion !== 'string' ||
      typeof parsed.message !== 'string'
    ) {
      throw new Error('Invalid impact report structure')
    }

    return parsed as ImpactReport
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
