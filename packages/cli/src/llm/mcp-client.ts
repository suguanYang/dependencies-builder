import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import debug, { error } from '../utils/debug'
import type { GitRepoConfig } from '../api'

let mcpClient: MultiServerMCPClient | null = null
let projectIdToConfigMap: Map<string, GitRepoConfig> = new Map()

// MCP endpoint - constructed from host and port
const MCP_SERVER_HOST = process.env.MCP_SERVER_HOST || '127.0.0.1'
const MCP_SERVER_PORT = process.env.MCP_SERVER_PORT || '3002'
const MCP_ENDPOINT = `http://${MCP_SERVER_HOST}:${MCP_SERVER_PORT}/mcp`

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

  debug('Initializing GitLab MCP client with endpoint: %s', MCP_ENDPOINT)
  projectIdToConfigMap = configMap

  if (configMap.size === 0) {
    throw new Error('At least one GitRepo configuration is required to initialize MCP client')
  }

  mcpClient = new MultiServerMCPClient({
    mcpServers: {
      gitlab: {
        transport: 'http',
        url: MCP_ENDPOINT,
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
}
