import { spawn } from 'node:child_process'
import kill from 'tree-kill'
import { error, info } from '../logging'
import { CreateActionDto } from '../actions/dto/create-action.dto'
import { getAdminUserKey, revokeAdminKey } from '../auth/auth.config'

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

export async function executeCLI(actionId: string, actionData: CreateActionDto, onSuccess: () => void, onError: (err?: string) => void): Promise<CLIExecution> {
  try {
    // Determine CLI command based on action type
    const cliCommand = getCLICommand(actionId, actionData)

    // Debug: Log the command being executed
    info(
      `Executing CLI command: ${cliCommand.join(' ')} with action data: ${JSON.stringify(actionData)}`,
    )

    const { key, id: keyId } = await getAdminUserKey(actionId)


    // Execute CLI command
    const [cmd, ...args] = cliCommand
    const childProcess = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DMS_SERVER_URL: process.env.DMS_SERVER_URL || 'http://127.0.0.1:3001',
        DMS_SERVER_CLI_KEY: key
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

        info(`action:${actionId} action is completed`)

        onSuccess()
      } else {
        error(`action:${actionId} CLI closed with code: ` + code)

        error(`action:${actionId} is failed`)

        onError(errorMessage)
      }
    })

    childProcess.on('error', async (err) => {
      await revokeAdminKey(keyId)

      error(`action:${actionId} Failed to execute CLI command: ` + err)

      activeExecutions.delete(actionId)

      onError()

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
    throw error
  }
}

export function getActiveExecution(actionId: string): CLIExecution | undefined {
  return activeExecutions.get(actionId)
}

function getCLICommand(actionId: string, actionData: CreateActionDto): string[] {
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
        "--action-id",
        actionId,
        '--verbose',
      ]

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
        "--action-id",
        actionId,
        '--verbose',
      ]

      return reportArgs
    default:
      throw new Error(`Unknown action type: ${actionData.type}`)
  }
}
