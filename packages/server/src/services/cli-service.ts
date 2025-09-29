import { ChildProcess, spawn } from 'child_process'
import * as repository from '../database/actions-repository'
import { Readable } from 'stream'
import { error, info } from '../logging'

interface ActionData {
  project: string
  branch: string
  type: 'static_analysis' | 'dependency_check' | 'validation'
}

export interface CLIExecutionResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
}

export interface CLIExecution {
  actionId: string
  stream: Readable
  stop(): void
}

const activeExecutions = new Map<string, CLIExecution>()

export async function executeCLI(actionId: string, actionData: ActionData): Promise<CLIExecution> {
  try {
    // Update action status to running
    await repository.updateAction(actionId, { status: 'running' })

    // Determine CLI command based on action type
    const cliCommand = getCLICommand(actionData)

    // Debug: Log the command being executed
    info(`Executing CLI command: ${cliCommand.join(' ')} with action data: ${JSON.stringify(actionData)}`)

    // Execute CLI command
    const [cmd, ...args] = cliCommand
    const childProcess = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DMS_SERVER_URL: process.env.DMS_SERVER_URL || 'http://localhost:3001',
      },
    })

    const stream = new Readable()

    childProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      info(`CLI ${cmd} stdout: ` + output)

      stream.push(`[info] ${output}`)
    })

    childProcess.stderr?.on('data', (data) => {
      const output = data.toString()
      error(`CLI ${cmd} stderr: ` + output)

      stream.push(`[error] ${output}`)
    })

    childProcess.on('close', async (code) => {
      activeExecutions.delete(actionId)

      if (code === 0) {
        info(`CLI ${cmd} closed with code: ` + code)
        repository.updateAction(actionId, {
          status: 'completed',
        })

        stream.push(`[info] action is completed` + '\n')
      } else {
        error(`CLI ${cmd} closed with code: ` + code)
        repository.updateAction(actionId, {
          status: 'failed',
        })

        stream.push(`[error] action is failed` + '\n')
      }

      stream.push(null)
    })

    childProcess.on('error', async (err) => {
      error('Failed to execute CLI command' + err)

      activeExecutions.delete(actionId)

      repository.updateAction(actionId, {
        status: 'failed',
      })

      stream.push(`[error]` + err + '\n')
      stream.push(null)
    })

    // Set timeout for CLI execution (10 minutes)
    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM')
    }, 10 * 60 * 1000)

    childProcess.on('close', () => {
      clearTimeout(timeout)
    })

    // Create CLIExecution object
    const execution: CLIExecution = {
      actionId,
      stream,
      stop: () => {
        childProcess.kill('SIGTERM')
        activeExecutions.delete(actionId)
      }
    }

    // Store active execution
    activeExecutions.set(actionId, execution)

    return execution
  } catch (error) {
    console.error(`CLI execution failed for action ${actionId}:`, error)
    await repository.updateAction(actionId, {
      status: 'failed',
    })
    throw error
  }
}

export function getActiveExecution(actionId: string): CLIExecution | undefined {
  return activeExecutions.get(actionId)
}

function getCLICommand(actionData: ActionData): string[] {
  const cliPath = '/home/suguan/github.com/suguanyang/dms/packages/cli/dist/index.js'

  switch (actionData.type) {
    case 'static_analysis':
      return [
        'node',
        cliPath,
        'analyze',
        actionData.project,
        '--branch',
        actionData.branch,
        "--verbose"
      ]
    case 'dependency_check':
      return [
        'node',
        cliPath,
        'dependencies',
        actionData.project,
        '--branch',
        actionData.branch,
      ]
    case 'validation':
      return [
        'node',
        cliPath,
        'validate',
        actionData.project,
        '--branch',
        actionData.branch,
      ]
    default:
      throw new Error(`Unknown action type: ${actionData.type}`)
  }
}

