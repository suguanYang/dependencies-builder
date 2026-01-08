import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { spawn, ChildProcess } from 'child_process'
import debug, { error } from '../utils/debug'
import type { GitRepoConfig } from '../api'

let mcpClient: MultiServerMCPClient | null = null
let projectIdToConfigMap: Map<string, GitRepoConfig> = new Map()
let mcpServerProcess: ChildProcess | null = null
const MCP_SERVER_PORT = 3002
const MCP_HOST = '127.0.0.1'
const MCP_SERVER_URL = `http://${MCP_HOST}:${MCP_SERVER_PORT}/mcp`

/**
 * Start the MCP server as a separate HTTP process
 */
async function startMCPServer(firstConfig: GitRepoConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    debug('Starting GitLab MCP server in HTTP mode on port %d', MCP_SERVER_PORT)

    mcpServerProcess = spawn('node', [require.resolve('@zereight/mcp-gitlab/build/index.js')], {
      env: {
        ...process.env,
        PORT: `${MCP_SERVER_PORT}`,
        HOST: MCP_HOST,
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

    mcpServerProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      debug('MCP Server: %s', output.trim())

      // Look for the message indicating the server is ready
      if (output.includes(`Endpoint: http://${MCP_HOST}:${MCP_SERVER_PORT}/mcp`)) {
        if (!started) {
          started = true
          // Give it a moment to fully start
          setTimeout(() => resolve(), 500)
        }
      }
    })

    mcpServerProcess.stderr?.on('data', (data) => {
      const output = data.toString()
      debug('MCP Server Error: %s', output.trim())
    })

    mcpServerProcess.on('error', (err) => {
      error('Failed to start MCP server: %o', err)
      reject(err)
    })

    mcpServerProcess.on('exit', (code) => {
      debug('MCP server process exited with code %d', code)
      mcpServerProcess = null
    })

    // Timeout if server doesn't start in 10 seconds
    setTimeout(() => {
      if (!started) {
        reject(new Error('MCP server failed to start within 10 seconds'))
      }
    }, 10000)
  })
}

/**
 * Stop the MCP server process
 */
async function stopMCPServer(): Promise<void> {
  if (!mcpServerProcess) {
    return
  }

  return new Promise((resolve) => {
    debug('Stopping MCP server...')

    mcpServerProcess!.on('exit', () => {
      debug('MCP server stopped')
      mcpServerProcess = null
      resolve()
    })

    mcpServerProcess!.kill('SIGTERM')

    // Force kill after 5 seconds if not stopped
    setTimeout(() => {
      if (mcpServerProcess) {
        debug('Force killing MCP server')
        mcpServerProcess.kill('SIGKILL')
        mcpServerProcess = null
        resolve()
      }
    }, 5000)
  })
}

/**
 * Initialize the MCP client for GitLab integration with dynamic API URL support
 * @param configMap Map of project IDs to their GitRepo configurations
 * @returns MultiServerMCPClient instance with loaded tools
 */
export async function initMCPClient(configMap: Map<string, GitRepoConfig>) {
  if (mcpClient) {
    debug('MCP client already initialized, updating projectId config map')
    projectIdToConfigMap = configMap
    return mcpClient
  }

  debug('Initializing GitLab MCP client with HTTP transport...')
  projectIdToConfigMap = configMap

  // Get any config for initial setup
  const firstConfig = configMap.values().next().value
  if (!firstConfig) {
    throw new Error('At least one GitRepo configuration is required to initialize MCP client')
  }

  // Start MCP server first
  await startMCPServer(firstConfig)

  mcpClient = new MultiServerMCPClient({
    mcpServers: {
      gitlab: {
        transport: 'http',
        url: MCP_SERVER_URL,
      },
    },

    // Inject project-specific headers for each tool call
    beforeToolCall: ({ serverName, name, args }) => {
      // Extract project_id from args to determine which GitRepo config to use
      const toolArgs = args as Record<string, unknown>
      const projectId = toolArgs.project_id as string | undefined

      if (!projectId) {
        debug('No project_id in tool call for %s, skipping header injection', name)
        return { args }
      }

      // Look up config directly from projectId map
      const matchingConfig = projectIdToConfigMap.get(projectId)

      if (!matchingConfig) {
        const errorMsg = `failed to load content for '${projectId}'. Please ensure this repository is configured in the admin panel.`
        error('ERROR: %s', errorMsg)
        throw new Error(errorMsg)
      }

      debug('Using GitRepo config for %s: API URL = %s', projectId, matchingConfig.apiUrl)

      // Inject custom headers for this specific call
      return {
        args,
        headers: {
          Authorization: `Bearer ${matchingConfig.accessToken}`,
          'X-GitLab-API-URL': matchingConfig.apiUrl,
        },
      }
    },
  })

  // Load tools from the MCP server
  const tools = await mcpClient.getTools()
  debug(`MCP client initialized with ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`)

  return mcpClient
}

/**
 * Get the current MCP client instance
 * @throws Error if client is not initialized
 */
export function getMCPClient(): MultiServerMCPClient {
  if (!mcpClient) {
    throw new Error('MCP client not initialized. Call initMCPClient() first.')
  }
  return mcpClient
}

/**
 * Close the MCP client and clean up resources
 */
export async function closeMCPClient(): Promise<void> {
  if (!mcpClient) {
    return
  }

  debug('Closing MCP client...')
  try {
    await mcpClient.close()
    mcpClient = null
    projectIdToConfigMap.clear()
    debug('MCP client closed successfully')
  } catch (error) {
    debug('Error closing MCP client: %o', error)
    // Still set to null to allow re-initialization
    mcpClient = null
    projectIdToConfigMap.clear()
  }

  // Stop the MCP server process
  await stopMCPServer()
}
