import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import type { GitLabConfig } from './config'
import debug from '../utils/debug'

let mcpClient: MultiServerMCPClient | null = null

/**
 * Initialize the MCP client for GitLab integration
 * @param config GitLab configuration
 * @returns MultiServerMCPClient instance with loaded tools
 */
export async function initMCPClient(config: GitLabConfig) {
  if (mcpClient) {
    debug('MCP client already initialized, reusing existing instance')
    return mcpClient
  }

  debug('Initializing GitLab MCP client...')

  mcpClient = new MultiServerMCPClient({
    gitlab: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@zereight/mcp-gitlab'],
      env: {
        GITLAB_PERSONAL_ACCESS_TOKEN: config.accessToken,
        GITLAB_API_URL: config.apiUrl,
        GITLAB_READ_ONLY_MODE: config.readOnlyMode ? 'true' : 'false',
      },
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
    debug('MCP client closed successfully')
  } catch (error) {
    debug('Error closing MCP client: %o', error)
    // Still set to null to allow re-initialization
    mcpClient = null
  }
}
