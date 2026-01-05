/**
 * Configuration for LLM integration
 * Loads settings from environment variables with sensible defaults
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
      temperature: 1,
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
      `Can not report on repo: ${inputAPI.hostname}, only support ${configuredAPI.hostname}`
    )
  }
}
