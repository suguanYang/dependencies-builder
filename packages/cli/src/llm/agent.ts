import { ChatOpenAI } from '@langchain/openai'
import type { BaseMessage } from '@langchain/core/messages'
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import type { LLMConfig } from './config'
import debug, { error } from '../utils/debug'
import { getMCPClient } from './mcp-client'

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
      logLevel: 'info',
      logger: {
        debug: debug,
        info: debug,
        warn: debug,
        error: debug,
      },
    },
    temperature: config.temperature,
    timeout: 600 * 1000,
  })

  // Get tools from MCP client
  const mcpClient = getMCPClient()
  const tools = await mcpClient.getTools()
  debug(`Agent using ${tools.length} tools from MCP`)

  // Bind tools to the model with retry logic
  const modelWithTools = llm.bindTools(tools).withRetry({
    stopAfterAttempt: 3,
  })

  // Create the initial messages
  const messages: BaseMessage[] = [
    new SystemMessage({
      content: `
You are a senior frontend developer with extensive experience in React and Web development.
Your goal is to produce STABLE and FACTUAL assessments of code change impacts.
You should give details about how the impact is determined, providing evidence strongly based on the source code.
Do not guess - only make claims you can support with specific code references and line numbers.
`,
    }),
    new HumanMessage({
      content: `Context:\n${context}\n\nInstruction:\n${instruction}`,
    }),
  ]

  debug('Starting agent execution...')

  // Simple agent loop - call model, execute tools if needed, repeat
  let currentMessages = [...messages]
  let iterationCount = 0
  const maxIterations = 50

  while (iterationCount < maxIterations) {
    iterationCount++
    debug(`\n${'='.repeat(80)}`)
    debug(`Agent iteration ${iterationCount}/${maxIterations}`)
    debug(`${'='.repeat(80)}`)

    // Log current conversation state with full content
    debug('\nCurrent conversation has %d messages:', currentMessages.length)
    currentMessages.forEach((msg, idx) => {
      const type = msg.type
      // let content =
      //   typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)

      debug(`\n[${idx}] ${type.toUpperCase()}:`)

      // Log tool calls for AI messages if present
      const toolCalls = (msg as any).tool_calls
      if (type === 'ai' && toolCalls && toolCalls.length > 0) {
        debug('  Tool Calls:')
        toolCalls.forEach((tc: any) => {
          debug(`    - ${tc.name}: ${JSON.stringify(tc.args)}`)
        })
      }

      if (type !== 'tool') {
        // debug('─'.repeat(60))
        // // Log content with indentation for readability
        // content.split('\n').forEach((line: string) => {
        //   debug(`  ${line}`)
        // })
        // debug('─'.repeat(60))
      }
    })

    // Call the model
    const response = await modelWithTools.invoke(currentMessages)

    // Log the full response
    debug('\n📥 LLM Response:')
    debug('─'.repeat(60))
    debug('Type: %s', response.type)

    const responseContent =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content, null, 2)
    debug('Content:')
    debug(`  ${responseContent.substring(0, 100)}...`)

    if (response.tool_calls && response.tool_calls.length > 0) {
      debug('\nTool calls requested: %d', response.tool_calls.length)
      response.tool_calls.forEach((tc, idx) => {
        debug(`  [${idx}] ${tc.name} (ID: ${tc.id})`)
        const argsStr = JSON.stringify(tc.args, null, 2)
        debug(`      ${argsStr.substring(0, 100)}...`)
      })
    }
    debug('─'.repeat(60))

    currentMessages.push(response)

    // Check if model wants to call tools
    if (!response.tool_calls || response.tool_calls.length === 0) {
      // No tool calls, agent is done
      debug('\n✅ Agent finished - no more tool calls requested')
      debug('Final response content:')
      debug(`  ${responseContent.substring(0, 100)}...`)
      return typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content)
    }

    debug(`\n🔧 Executing ${response.tool_calls.length} tool call(s)...`)

    // Execute all tool calls and collect results
    const toolMessages: BaseMessage[] = []

    for (const toolCall of response.tool_calls) {
      debug(`\n  ▶ Tool: ${toolCall.name}`)
      debug(`    ID: ${toolCall.id}`)
      debug(`    Args:`)
      debug(`      ${JSON.stringify(toolCall.args, null, 2).substring(0, 100)}...`)

      try {
        // Find the tool by name
        const tool = tools.find((t) => t.name === toolCall.name)
        if (!tool) {
          throw new Error(`Tool ${toolCall.name} not found`)
        }

        // Invoke the tool
        const toolResult = await tool.invoke(toolCall.args || {})

        // Post-process tool results: add line numbers to file contents
        let processedResult = toolResult
        if (toolCall.name === 'get_file_contents' && toolResult && typeof toolResult === 'string') {
          // Add line numbers to file content for better LLM comprehension
          const lines = toolResult.split('\n')
          const numberedLines = lines.map((line, index) => {
            const lineNumber = (index + 1).toString().padStart(4, ' ')
            return `${lineNumber}: ${line}`
          })
          processedResult = numberedLines.join('\n')
        }

        // Check if the result is already a ToolMessage
        if (processedResult && typeof processedResult === 'object' && 'type' in processedResult) {
          debug(`    ✓ Result (ToolMessage):`)
          toolMessages.push(processedResult)
        } else {
          // Create a ToolMessage with proper tool_call_id
          const resultStr =
            typeof processedResult === 'string'
              ? processedResult
              : JSON.stringify(processedResult, null, 2)
          // Logging handled above
          const toolMessage = new ToolMessage({
            content: resultStr,
            tool_call_id: toolCall.id || '',
          })
          toolMessages.push(toolMessage)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        error(`    ✗ Error: ${errorMsg}`)
        // Create a ToolMessage for the error with the matching tool_call_id
        const errorMessage = new ToolMessage({
          content: `Error: ${errorMsg}`,
          tool_call_id: toolCall.id || '',
        })
        toolMessages.push(errorMessage)
      }
    }

    // Add all tool messages to the conversation
    debug('\n📤 Adding %d tool result(s) to conversation', toolMessages.length)
    currentMessages.push(...toolMessages)
  }

  // Max iterations reached
  error('\n⚠️  Max iterations (%d) reached', maxIterations)
  debug('Returning last message in conversation')
  const lastMessage = currentMessages[currentMessages.length - 1]
  return typeof lastMessage.content === 'string'
    ? lastMessage.content
    : JSON.stringify(lastMessage.content)
}
