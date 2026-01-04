/**
 * LLM Integration Module
 *
 * Provides AI-powered impact analysis for dependency changes using
 * LangChain, LangGraph, and GitLab MCP integration.
 */

export { analyzeImpact, type ImpactReport, type ImpactAnalysisInput } from './analyzer'
export {
  loadLLMConfig,
  validateLLMConfig,
  type LLMConfig,
  type GitLabConfig,
  type LLMIntegrationConfig,
} from './config'
export { initMCPClient, closeMCPClient, getMCPClient } from './mcp-client'
export { invokeLLMAgent, type AgentState } from './agent'
