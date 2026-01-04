import { ChatOpenAI } from '@langchain/openai'
import type { BaseMessage } from '@langchain/core/messages'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { LLMConfig } from './config'
import { getMCPClient } from './mcp-client'
import debug from '../utils/debug'

/**
 * State for the agent
 */
export interface AgentState {
  messages: BaseMessage[]
}

/**
 * Create and invoke the LLM agent for impact analysis
 * @param context The context string containing project info and affected nodes
 * @param instruction The instruction for the agent
 * @param config LLM configuration
 * @returns The final message from the agent
 */
export async function invokeLLMAgent(
  context: string,
  instruction: string,
  config: LLMConfig,
): Promise<string> {
  debug('Initializing LLM agent...')

  // Initialize the LLM
  const llm = new ChatOpenAI({
    model: config.modelName,
    apiKey: config.apiKey,
    configuration: {
      baseURL: config.baseUrl,
    },
    temperature: config.temperature,
  })

  // Get tools from MCP client
  const mcpClient = getMCPClient()
  const tools = await mcpClient.getTools()
  debug(`Agent using ${tools.length} tools from MCP`)

  // Bind tools to the model
  const modelWithTools = llm.bindTools(tools)

  // Create the initial messages
  const messages: BaseMessage[] = [
    new SystemMessage({
      content:
        'You are a senior frontend developer with extensive experience in React and Web development. You are reviewing merge requests and analyzing potential impacts on dependent projects.',
    }),
    new HumanMessage({
      content: `Context:\n${context}\n\nInstruction:\n${instruction}`,
    }),
  ]

  debug('Starting agent execution...')

  // Simple agent loop - call model, execute tools if needed, repeat
  let currentMessages = [...messages]
  let iterationCount = 0
  const maxIterations = 10

  while (iterationCount < maxIterations) {
    iterationCount++
    debug(`Agent iteration ${iterationCount}/${maxIterations}`)

    // Call the model
    const response = await modelWithTools.invoke(currentMessages)
    currentMessages.push(response)

    // Check if model wants to call tools
    if (!response.tool_calls || response.tool_calls.length === 0) {
      // No tool calls, agent is done
      debug('Agent finished without tool calls')
      return typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content)
    }

    debug(`Agent requested ${response.tool_calls.length} tool calls`)

    // Execute all tool calls
    for (const toolCall of response.tool_calls) {
      debug(`Executing tool: ${toolCall.name}`)

      try {
        // Find the tool by name
        const tool = tools.find((t) => t.name === toolCall.name)
        if (!tool) {
          throw new Error(`Tool ${toolCall.name} not found`)
        }

        // Invoke the tool
        const toolResult = await tool.invoke(toolCall.args || {})

        // Add tool message to conversation
        // Note: LangChain tools return ToolMessage objects directly
        currentMessages.push(toolResult)
        debug(`Tool ${toolCall.name} executed successfully`)
      } catch (error) {
        debug(`Error executing tool ${toolCall.name}: %o`, error)
        // Add error message so agent can handle it
        currentMessages.push(
          new HumanMessage({
            content: `Error executing tool ${toolCall.name}: ${error instanceof Error ? error.message : String(error)}`,
          }),
        )
      }
    }
  }

  // Max iterations reached
  debug('Max iterations reached, returning last message')
  const lastMessage = currentMessages[currentMessages.length - 1]
  return typeof lastMessage.content === 'string'
    ? lastMessage.content
    : JSON.stringify(lastMessage.content)
}
