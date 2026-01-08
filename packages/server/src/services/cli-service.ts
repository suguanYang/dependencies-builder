import { spawn } from 'node:child_process'
import kill from 'tree-kill'
import { getAdminUserKey, revokeAdminKey } from '../auth'
import { error, info } from '../logging'
import * as repository from '../database/repository'

export type ActionData = Required<repository.CreateActionData> & {
  targetBranch?: string
}

export interface CLIExecutionResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
}

export interface CLIExecution {
  actionId: string
  stop(): Promise<void>
}

const activeExecutions = new Map<string, CLIExecution>()

export async function executeCLI(actionId: string, actionData: ActionData): Promise<CLIExecution> {
  try {
    // Update action status to running
    await repository.updateAction(actionId, { status: 'running' })

    // Determine CLI command based on action type
    const cliCommand = getCLICommand(actionId, actionData)

    // Debug: Log the command being executed
    info(
      `Executing CLI command: ${cliCommand.join(' ')} with action data: ${JSON.stringify(actionData)}`,
    )

    const { key, id: keyId } = await getAdminUserKey(actionId)

    // Fetch LLM config from database
    const llmConfig = await repository.getLLMConfig()
    const llmEnv: Record<string, string> = {}
    if (llmConfig && llmConfig.enabled) {
      llmEnv.OPENAI_API_KEY = llmConfig.apiKey
      llmEnv.OPENAI_BASE_URL = llmConfig.baseUrl
      llmEnv.OPENAI_MODEL_NAME = llmConfig.modelName
      llmEnv.OPENAI_TEMPERATURE = String(llmConfig.temperature)

      // Token Budget Configuration
      llmEnv.LLM_MODEL_MAX_TOKENS = String(llmConfig.modelMaxTokens)
      llmEnv.LLM_SAFE_BUFFER = String(llmConfig.safeBuffer)
      llmEnv.LLM_SYSTEM_PROMPT_COST = String(llmConfig.systemPromptCost)
      llmEnv.LLM_WINDOW_SIZE = String(llmConfig.windowSize)

      // Rate Limiting Configuration
      llmEnv.LLM_REQUESTS_PER_MINUTE = String(llmConfig.requestsPerMinute)
    } else {
      info(
        `action:${actionId} No LLM configuration found in database (or disabled). Using environment variables.`,
      )
    }

    // Execute CLI command
    const [cmd, ...args] = cliCommand
    const childProcess = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DMS_SERVER_URL: process.env.DMS_SERVER_URL || 'http://127.0.0.1:3001',
        DMS_SERVER_CLI_KEY: key,
        // MCP configuration - server manages MCP lifecycle
        MCP_SERVER_HOST: process.env.MCP_SERVER_HOST || '127.0.0.1',
        MCP_SERVER_PORT: process.env.MCP_SERVER_PORT || '3002',
        ...llmEnv,
      },
    })

    childProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      const trimmedOutput = output.trim()

      // Also write to general info log for backward compatibility
      info(`action:${actionId} ${trimmedOutput}`)
    })

    let errorMessage = ''
    childProcess.stderr?.on('data', (data) => {
      const output = data.toString()
      const trimmedOutput = output.trim()

      // Also write to general error log for backward compatibility
      error(`action:${actionId} ${trimmedOutput}`)
      errorMessage += trimmedOutput
    })

    childProcess.on('close', async (code) => {
      await revokeAdminKey(keyId)
      activeExecutions.delete(actionId)

      if (code === 0) {
        info(`action:${actionId} CLI closed with code: ` + code)
        repository.updateAction(actionId, {
          status: 'completed',
        })

        info(`action:${actionId} action is completed`)
      } else {
        error(`action:${actionId} CLI closed with code: ` + code)
        repository.updateAction(actionId, {
          status: 'failed',
        })

        if (errorMessage) {
          repository.updateAction(actionId, {
            error: errorMessage,
          })
        }

        error(`action:${actionId} is failed`)
      }
    })

    childProcess.on('error', async (err) => {
      await revokeAdminKey(keyId)

      error(`action:${actionId} Failed to execute CLI command: ` + err)

      activeExecutions.delete(actionId)

      repository.updateAction(actionId, {
        status: 'failed',
      })

      error(`action:${actionId} Failed to execute CLI command: ${err.message || err}`)
    })

    // Set timeout for CLI execution (10 minutes)
    const timeout = setTimeout(
      () => {
        childProcess.kill('SIGTERM')
      },
      10 * 60 * 1000,
    )

    childProcess.on('close', () => {
      clearTimeout(timeout)
    })

    // Create CLIExecution object
    const execution: CLIExecution = {
      actionId,
      stop: async () => {
        return new Promise((resolve, reject) => {
          kill(childProcess.pid!, async (err) => {
            if (err) {
              reject(err)
              return
            }
            await repository.updateAction(actionId, {
              status: 'failed',
              error: 'stopped',
            })
            resolve()
          })
        })
      },
    }

    // Store active execution
    activeExecutions.set(actionId, execution)

    return execution
  } catch (err) {
    error(err)
    await repository.updateAction(actionId, {
      status: 'failed',
      error: `Failed to excute cli: ${err instanceof Error ? err.message : err}`,
    })
    throw err
  }
}

export function getActiveExecution(actionId: string): CLIExecution | undefined {
  return activeExecutions.get(actionId)
}

function getCLICommand(actionId: string, actionData: ActionData): string[] {
  switch (actionData.type) {
    case 'static_analysis':
      const analyzeArgs = [
        'npx',
        '@dms/cli',
        'analyze',
        actionData.projectAddr,
        '--branch',
        actionData.branch,
        '--name',
        actionData.projectName,
        '--action-id',
        actionId,
        '--verbose',
      ]

      // Add ignore-call-graph flag if specified
      if (actionData.ignoreCallGraph) {
        analyzeArgs.push('--ignore-call-graph')
      }

      return analyzeArgs
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
        '--name',
        actionData.projectName,
        '--action-id',
        actionId,
        '--verbose',
      ]

      // Add ignore-call-graph flag if specified
      if (actionData.ignoreCallGraph) {
        reportArgs.push('--ignore-call-graph')
      }

      return reportArgs
    default:
      throw new Error(`Unknown action type: ${actionData.type}`)
  }
}
