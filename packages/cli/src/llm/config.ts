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
  /** Whether LLM integration is enabled (OPENAI_API_KEY is set) */
  enabled: boolean
}

/**
 * Load LLM configuration from environment variables
 * @returns Configuration object with enabled flag
 */
export function loadLLMConfig(): LLMIntegrationConfig {
  const apiKey = process.env.OPENAI_API_KEY || ''

  // LLM is enabled if we have the OpenAI API key
  // GitLab config MUST come from GitRepo database - no env var fallback
  const enabled = !!apiKey

  return {
    llm: {
      apiKey: apiKey || 'sk-placeholder',
      baseUrl: process.env.OPENAI_BASE_URL || 'http://localhost:11434/v1',
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: Number(process.env.OPENAI_TEMPERATURE) || 1,
    },
    enabled,
  }
}

/**
 * Validate that required configuration is present
 * @throws Error if required configuration is missing
 */
export function validateLLMConfig(config: LLMIntegrationConfig): void {
  if (!config.enabled) {
    throw new Error('LLM integration is not enabled. Required environment variable: OPENAI_API_KEY')
  }
}
