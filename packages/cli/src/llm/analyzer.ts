import type { Connection, LocalNode } from '../server-types'
import { loadLLMConfig, validateLLMConfig } from './config'
import { initMCPClient, closeMCPClient } from './mcp-client'
import { invokeLLMAgent } from './agent'
import debug, { error } from '../utils/debug'
import { generateNodeId } from '../utils/node-id'

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
  projectName: string
  projectAddr: string
  sourceBranch: string
  targetBranch: string
  affectedToNodes: LocalNode[]
  affectedConnections: Connection[]
  changedContext?: Map<string, string[]>
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
    const context = await prepareContext(input)
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

  const impactsWithContent = await Promise.all(
    impactData.map(async (item) => {
      const { fromNode, toNode, projectID, changedLines } = item

      // Fetch both impacted and dependent code files in parallel
      const [impactedFileContent, dependentFileContent] = await Promise.all([
        // Fetch impacted code file (from dependent project)
        getFileContentsTool
          .invoke({
            project_id: projectID,
            file_path: fromNode.relativePath,
            ref: fromNode.branch,
          })
          .catch((err) => {
            error(
              'Failed to fetch impacted code for %s in project %s: %o',
              fromNode.relativePath,
              fromNode.projectName,
              err,
            )
            return `[Error fetching file: ${err instanceof Error ? err.message : String(err)}]`
          }),
        // Fetch dependent code file (from current project)
        getFileContentsTool
          .invoke({
            project_id: currentProjectID,
            file_path: toNode.relativePath,
            ref: input.sourceBranch,
          })
          .catch((err) => {
            error(
              'Failed to fetch dependent code for %s in current project: %o',
              toNode.relativePath,
              err,
            )
            return `[Error fetching file: ${err instanceof Error ? err.message : String(err)}]`
          }),
      ])

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

      return {
        ...item,
        impactedCodeContent: impactedContent,
        dependentCodeContent: dependentContent,
      }
    }),
  )

  // Only filter out entries with no changes at all (no fragile whitespace filtering)
  const validImpacts = impactsWithContent.filter((item) => {
    return item.changedLines && item.changedLines.length > 0
  })

  // Validate we still have nodes after filtering
  if (validImpacts.length === 0) {
    throw new Error('No valid affected nodes after filtering - cannot perform LLM analysis')
  }

  return `
Current Project Id: ${currentProjectID}
Current Project Name: ${input.projectName}
Current Project Source Branch: ${input.sourceBranch}
Current Project Target Branch: ${input.targetBranch}

Potential Impacted Codes(${validImpacts.length}):
${validImpacts
  .map((item, index) => {
    const { fromNode, toNode, projectID, changedLines, impactedCodeContent, dependentCodeContent } =
      item

    const parts = [
      `Potential Impacted Code: project_name:${fromNode.projectName}, project_id:${projectID}, branch:${fromNode.branch}, file:${fromNode.relativePath}, line:${fromNode.startLine}`,
      `Dependent Code: project_id:${currentProjectID}, branch:${input.sourceBranch}, file:${toNode.relativePath}, line:${toNode.startLine}`,
    ]

    // Add changed code context
    let changeContextString = ''
    if (changedLines && changedLines.length > 0) {
      const formattedChanges = changedLines
        .map((block) =>
          block
            .split('\n')
            .map((line) => `        ${line}`)
            .join('\n'),
        )
        .join('\n')
      changeContextString = `\n      Changed Code[${currentProjectID}]:\n${formattedChanges}`
    }

    // Add dependent code file content with line numbers
    let dependentCodeString = ''
    if (dependentCodeContent) {
      const lines = dependentCodeContent.split('\n')
      const numberedLines = lines
        .map((line, idx) => {
          const lineNum = (idx + 1).toString().padStart(4, ' ')
          return `        ${lineNum}: ${line}`
        })
        .join('\n')
      dependentCodeString = `\n      Dependent Code File Content:\n${numberedLines}`
    }

    // Add impacted code file content with line numbers
    let impactedCodeString = ''
    if (impactedCodeContent) {
      const lines = impactedCodeContent.split('\n')
      const numberedLines = lines
        .map((line, idx) => {
          const lineNum = (idx + 1).toString().padStart(4, ' ')
          return `        ${lineNum}: ${line}`
        })
        .join('\n')
      impactedCodeString = `\n      Impacted Code File Content:\n${numberedLines}`
    }

    return `  - ${index + 1}. ${parts.join('\n      ')}${changeContextString}${dependentCodeString}${impactedCodeString}`
  })
  .join('\n\n')}
`.trim()
}

/**
 * Prepare the instruction for the LLM agent
 */
function prepareInstruction(): string {
  return `
**IMPORTANT: Please provide your analysis in CHINESE (中文). All text fields should be in Chinese.**

**Your Task:**
Analyze how the "Changed Code" impact on the "Potential Impacted Code" and generate a JSON report WITH PER-Impacted-Code SUGGESTIONS.

**Input Format Understanding:**
The provided context consists of multiple entries. Each entry represents a dependency relation:
1.  **Dependency Link:** What is being used and Who is using the code.("Potential Impacted Code" => "Dependent Code")
2.  **Changed Content:** What is being changed("Changed Code" affect "Dependent Code"  affect "Potential Impacted Code").
3.  Each "Potential Impacted Code" entry includes:
  a. **Potential Impacted Code**: The location in the dependent project that imports/uses the changed code
  b. **Dependent Code**: The location in the current project that was changed
  c. **Changed Code**: The actual diff showing what changed
  d. **Dependent Code File Content**: The COMPLETE file content from the current project (with line numbers)
  e. **Impacted Code File Content**: The COMPLETE file content from the dependent project (with line numbers)

**Analysis Guidelines (Chain of Thought):**
1.  **Step 1: Noise Filtering (CRITICAL - DO THIS FIRST)**
    *   **BEFORE analyzing anything else**, examine ONLY the "Changed Code" diff for each entry
    *   **ONLY the following are cosmetic (safe)**:
        *   **Pure whitespace**: ONLY adding/removing spaces, tabs, or empty lines
            - Example: () => {} to () => { } is COSMETIC
            - Example: function(){} to function() {} is COSMETIC  
        *   **Pure comments/docs**: ONLY adding/removing comments or JSDoc (no code changes)
        *   **Pure formatting**: ONLY line breaks, indentation changes (no code changes)
    *   **The following are NOT cosmetic (must analyze)**:
        *   **Function/variable renames**: fetchJSModule to fetchResource is NOT cosmetic
        *   **Error handling changes**: Adding try/catch, throw statements, changing error logic is NOT cosmetic
        *   **Function signature changes**: Adding/removing parameters, changing return type is NOT cosmetic
        *   **Logic changes**: ANY change to if/else, loops, function calls, operators is NOT cosmetic
        *   **Import/export changes**: Adding/removing imports, changing what's exported is NOT cosmetic
        *   **API behavior changes**: Changing side effects, async behavior, error propagation is NOT cosmetic
    *   **Rule**: If ANY line has code logic changes (not just whitespace/comments), it is NOT cosmetic
    *   **For PURELY cosmetic entries only, output**:
        - projectName: project name from the entry
        - impacts: [Explain why it's safe, e.g., "仅添加注释说明，未修改代码逻辑"]
        - level: "safe"
        - suggestions: [null]
    *   Continue to next entry immediately 

2.  **Step 2: API Contract Analysis**
    *   Examine "Potential Impacted Code"
    *   Match the affected "Potential Impacted Code" with the coressponding "Changed Code" exactly
    *   **CRITICAL: Distinguish import statements from actual usage**:
        *   Pure ES6 import statements (e.g., import { foo } from 'bar') are NOT impacts by themselves
        *   Imports are just declarations - they don't execute code (unless the module has side effects)
        *   **Only flag the actual usage sites** where the imported function/variable is called/used
        *   Example: If line 2 is [import { appDynamicImport }] and line 18 is [appDynamicImport()], only line 18 is impacted
    *   Does the changes modify export signatures? (Function arguments, return types, generic types).
    *   If parameters are added, are they optional? If mandatory, this is a **HIGH** impact breaking change.
    *   If a function is renamed or removed, this is a **HIGH** impact breaking change.
    *   Is The API Contract still works for the "Potential Impacted Code"?

3.  **Step 3: Behavioral & Internal Logic Analysis**
    *   If the API signature is unchanged, look at the internal logic, the "Changed Code" is maybe a function on the callstack.
    *   Did the error handling change? (e.g., throw  vs return, or changing error codes).
    *   Did the side effects change? (e.g., writing to window, LocalStorage).
    *   Did the "Potential Impacted Code" can still work for the "Changed Code"?

4.  **Step 4: Synthesize Report (in Chinese)**
    *   Group results by "Potential Impacted Code".
    *   Reference specific line numbers when describing the impact
    *   Provide actionable suggestions.

**Analysis Strategy:**
- Use the line number from "Dependent Code" to locate where the change occurred in "Dependent Code File Content"
- Use the line number from "Potential Impacted Code" to locate the exact usage in "Impacted Code File Content"
- Analyze how the changes in "Dependent Code File Content" will affect the usage in "Impacted Code File Content"

**IMPORTANT Instructions:**
- For each entry, use the line number to find the exact usage in the "Impacted Code File Content"
- Analyze how the "Changed Code" affects the actual usage shown in the "Impacted Code File Content"
- **CRITICAL**: Each impact description MUST include a code snippet showing the impacted code:
  - Extract 3-5 lines of code from "Impacted Code File Content" centered around the line number
  - Format as: "文件xxx第N行: [code snippet] - 影响描述"
  - Example: "文件src/app.tsx第116行: [refreshAppInfoCache()] 调用处 - 该函数错误处理逻辑变化可能影响异常捕获"
- Provide specific line-number references when describing impacts
- If the given context can not determine the impactation, try to grab more files that related to the code by calling related tools, like get_file_content

**Summary Field Requirements:**
- The summary field must be an ARRAY of strings, one entry per changed file
- Each entry should describe the changes in that specific file
- Format each entry as: "filename: description of changes"
- Example: ["src/utils/ajax/index.ts: 重命名fetchJSModule为fetchResource，简化fetch参数", "src/infra/runtime.ts: 新增appDynamicImport函数JSDoc文档说明资源版本管理协议", "src/utils/_import.ts: 调整错误处理逻辑，改为抛出异常而非记录APM"]
- Help users quickly understand which files changed and what changed in each file

**Output Format (JSON only, text content in CHINESE):**
\`\`\`json
{
  "success": true,
  "summary": [
    "src/utils/ajax/index.ts: 仅格式化变更，无逻辑修改",
    "src/infra/runtime.ts: 新增appDynamicImport函数的详细JSDoc文档",
    "src/utils/_import.ts: 重构fetchResource函数，调整错误处理机制"
  ],
  "level": "safe|low|medium|high", // 项目整体影响程度, 取所有受影响项目中最高的影响程度
  "affectedProjects": [
    {
      "projectName": "project-name-1",
      "impacts": [
        "path/to/file.ts第123行: [functionCall()] 调用处 - 具体影响描述，说明变更如何影响此处代码",
        "path/to/file.ts第456行: [anotherCall()] 调用处 - 另一处影响的具体描述"
      ],
      "level": "safe|low|medium|high",
      "suggestions": [
        "该代码1的建议",
        "该代码2的建议"
      ]
    }
  ],
  "message": "附加上下文或错误详情"
}
\`\`\`

**Impact Level Guidelines:**
- **high**: Breaking changes, API changes, critical functionality affected
- **medium**: Non-breaking changes with potential issues, deprecated features
- **low**: Minor changes, internal refactoring, documentation updates
- **safe**: Cosmetic changes, no impact on functionality
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
