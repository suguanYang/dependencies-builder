import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import type { GitLabConfig } from './config'
import debug from '../utils/debug'

/**
 * Disposable wrapper for MCP client that implements Symbol.dispose
 */
class DisposableMCPClient implements Disposable {
  constructor(private client: MultiServerMCPClient) { }

  getClient(): MultiServerMCPClient {
    return this.client
  }

  async [Symbol.dispose](): Promise<void> {
    debug('Disposing MCP client...')
    try {
      await this.client.close()
      debug('MCP client disposed successfully')
    } catch (error) {
      debug('Error disposing MCP client: %o', error)
      // Don't rethrow - disposal errors shouldn't break the flow
    }
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this[Symbol.dispose]()
  }
}

/**
 * Initialize the MCP client for GitLab integration
 * Returns a disposable client that auto-cleans up with 'using' syntax
 * @param config GitLab configuration
 * @returns DisposableMCPClient instance
 */
export async function createMCPClient(config: GitLabConfig): Promise<DisposableMCPClient> {
  debug('Initializing GitLab MCP client...')

  const mcpClient = new MultiServerMCPClient({
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

  return new DisposableMCPClient(mcpClient)
}

// Legacy singleton-style exports for backward compatibility
let mcpClient: MultiServerMCPClient | null = null

/**
 * @deprecated Use createMCPClient() with 'using' syntax instead
 */
export async function initMCPClient(config: GitLabConfig) {
  if (mcpClient) {
    debug('MCP client already initialized, reusing existing instance')
    return mcpClient
  }

  const disposableClient = await createMCPClient(config)
  mcpClient = disposableClient.getClient()
  return mcpClient
}

/**
 * @deprecated Use createMCPClient() with 'using' syntax instead
 */
export function getMCPClient(): MultiServerMCPClient {
  if (!mcpClient) {
    throw new Error('MCP client not initialized. Call initMCPClient() first.')
  }
  return mcpClient
}

/**
 * @deprecated Use createMCPClient() with 'using' syntax instead
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
    mcpClient = null
  }
}
