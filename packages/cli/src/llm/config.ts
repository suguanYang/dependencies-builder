/**
 * Configuration for LLM integration
 * Loads settings from environment variables with sensible defaults
 *
 * Environment Variables:
 *
 * LLM Model Configuration:
 * - OPENAI_API_KEY: API key for OpenAI or compatible service (required)
 * - OPENAI_BASE_URL: Base URL for API (default: http://localhost:11434/v1)
 * - OPENAI_MODEL_NAME: Model to use (default: gpt-4o)
 * - OPENAI_TEMPERATURE: Temperature for responses 0-1 (default: 1)
 *
 * GitLab MCP Configuration:
 * - GITLAB_PERSONAL_ACCESS_TOKEN: GitLab PAT for file access (required)
 * - GITLAB_API_URL: GitLab instance URL (default: http://gitlab.seeyon.com)
 *
 * Token Budget Configuration (see TOKEN_BUDGET_CONFIG.md):
 * - LLM_MODEL_MAX_TOKENS: Max context window (default: 128000)
 * - LLM_SAFE_BUFFER: Tokens reserved for output (default: 4000)
 * - LLM_SYSTEM_PROMPT_COST: Estimated prompt tokens (default: 2000)
 * - LLM_WINDOW_SIZE: Smart window size in lines (default: 100)
 * - LLM_REQUESTS_PER_MINUTE: Rate limit for API calls (default: 60)
 */

export interface LLMConfig {
  /** OpenAI API key (required even for local models) */
  apiKey: string
  /** Base URL for OpenAI-compatible API */
  baseUrl: string
  /** Model name to use */
  modelName: string
  /** Temperature for model responses (0-1) */
  temperature: number
}

export interface GitLabConfig {
  /** GitLab personal access token */
  accessToken: string
  /** GitLab API URL */
  apiUrl: string
  /** Whether to use read-only mode */
  readOnlyMode: boolean
}

export interface LLMIntegrationConfig {
  llm: LLMConfig
  gitlab: GitLabConfig
  /** Whether LLM integration is enabled (all required env vars are set) */
  enabled: boolean
}

/**
 * Load LLM configuration from environment variables
 * @returns Configuration object with enabled flag
 */
export function loadLLMConfig(): LLMIntegrationConfig {
  const apiKey = process.env.OPENAI_API_KEY || ''
  const gitlabToken = process.env.GITLAB_PERSONAL_ACCESS_TOKEN || ''

  // Check if all required config is present
  const enabled = !!(apiKey && gitlabToken)

  return {
    llm: {
      apiKey: apiKey || 'sk-placeholder',
      baseUrl: process.env.OPENAI_BASE_URL || 'http://localhost:11434/v1',
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: Number(process.env.OPENAI_TEMPERATURE) || 1,
    },
    gitlab: {
      accessToken: gitlabToken,
      apiUrl: process.env.GITLAB_API_URL || 'http://gitlab.seeyon.com',
      readOnlyMode: true,
    },
    enabled,
  }
}

/**
 * Validate that required configuration is present
 * @throws Error if required configuration is missing
 */
export function validateLLMConfig(config: LLMIntegrationConfig, porjectAddr: string): void {
  if (!config.enabled) {
    throw new Error(
      'LLM integration is not enabled. Required environment variables: OPENAI_API_KEY, GITLAB_PERSONAL_ACCESS_TOKEN',
    )
  }

  const configuredAPI = new URL(config.gitlab.apiUrl)
  const inputAPI = new URL(porjectAddr)

  if (configuredAPI.hostname != inputAPI.hostname) {
    throw new Error(
      `Can not report on repo: ${inputAPI.hostname}, only support ${configuredAPI.hostname}`,
    )
  }
}
