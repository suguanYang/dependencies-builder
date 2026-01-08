import { spawn, ChildProcess } from 'child_process'
import { info, error as logError } from '../logging'
import * as repository from '../database/repository'

export class MCPServerService {
  private process: ChildProcess | null = null
  private readonly port: number
  private readonly host: string
  private startPromise: Promise<void> | null = null

  constructor() {
    this.port = parseInt(process.env.MCP_SERVER_PORT || '3002', 10)
    this.host = process.env.MCP_SERVER_HOST || '127.0.0.1'
  }

  /**
   * Start the MCP server process
   */
  async start(): Promise<void> {
    // Prevent multiple simultaneous starts
    if (this.startPromise) {
      return this.startPromise
    }

    if (this.process) {
      info('MCP server already running')
      return
    }

    this.startPromise = this._doStart()
    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  private async _doStart(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      info('Starting GitLab MCP server...')

      // Fetch GitRepo configs and filter enabled ones
      const gitRepos = await repository.getGitRepos()
      const enabledRepos = gitRepos.data.filter((repo) => repo.enabled)

      if (enabledRepos.length === 0) {
        const errMsg = 'No enabled GitRepo configurations found. MCP server will not start.'
        logError(errMsg)
        reject(new Error('No GitRepo configurations available'))
        return
      }

      const firstConfig = enabledRepos[0]
      info(`Using GitRepo '${firstConfig.name}' for MCP server initial configuration`)

      this.process = spawn('node', [require.resolve('@zereight/mcp-gitlab/build/index.js')], {
        env: {
          ...process.env,
          PORT: `${this.port}`,
          HOST: this.host,
          ENABLE_DYNAMIC_API_URL: 'true',
          REMOTE_AUTHORIZATION: 'true',
          STREAMABLE_HTTP: 'true',
          GITLAB_READ_ONLY_MODE: 'true',
          GITLAB_API_URL: firstConfig.apiUrl,
          GITLAB_PERSONAL_ACCESS_TOKEN: firstConfig.accessToken,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let started = false

      this.process.stdout?.on('data', (data) => {
        const output = data.toString()
        info(`MCP Server (stdout): ${output.trim()}`)
      })

      this.process.stderr?.on('data', (data) => {
        const output = data.toString()
        info(`MCP Server (stderr): ${output.trim()}`)

        // Look for the message indicating the server is ready
        // Pino logs to stderr (destination: 2)
        if (output.includes(`Endpoint: http://${this.host}:${this.port}/mcp`)) {
          if (!started) {
            started = true
            info(`MCP server ready at http://${this.host}:${this.port}/mcp`)
            setTimeout(() => resolve(), 500)
          }
        }
      })

      this.process.on('error', (err) => {
        logError('MCP server process error:' + JSON.stringify(err))
        this.process = null
        reject(err)
      })

      this.process.on('exit', (code, signal) => {
        info(`MCP server process exited with code ${code} and signal ${signal}`)
        this.process = null

        // Auto-restart on unexpected exit (not during shutdown)
        if (code !== 0 && code !== null) {
          logError(`MCP server crashed with code ${code}, restarting in 5 seconds...`)
          setTimeout(() => {
            this.start().catch((err) => logError('Failed to restart MCP server:', err))
          }, 5000)
        }
      })

      // Timeout if server doesn't start in 15 seconds
      setTimeout(() => {
        if (!started) {
          logError('MCP server failed to start within 15 seconds')
          this.stop()
          reject(new Error('MCP server startup timeout'))
        }
      }, 15000)
    })
  }

  /**
   * Stop the MCP server process gracefully
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return
    }

    return new Promise((resolve) => {
      info('Stopping MCP server...')

      this.process!.on('exit', () => {
        info('MCP server stopped')
        this.process = null
        resolve()
      })

      this.process!.kill('SIGTERM')

      // Force kill after 5 seconds if not stopped
      setTimeout(() => {
        if (this.process) {
          info('Force killing MCP server')
          this.process.kill('SIGKILL')
          this.process = null
          resolve()
        }
      }, 5000)
    })
  }

  /**
   * Get the MCP server endpoint URL
   */
  getEndpoint(): string {
    return `http://${this.host}:${this.port}/mcp`
  }

  /**
   * Check if MCP server is running
   */
  isRunning(): boolean {
    return this.process !== null
  }
}

// Export singleton instance
export const mcpServerService = new MCPServerService()
