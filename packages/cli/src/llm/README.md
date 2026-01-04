```
import path from "path";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

// 1. Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY |

| "sk-placeholder"; // Required even for local models
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL |

| "http://localhost:11434/v1"; // e.g., Ollama, Groq, etc.
const MODEL_NAME = "gpt-4o"; // Or "llama3", "mixtral", etc.

async function main() {
  console.log("🚀 Starting AI Agent...");

  // ---------------------------------------------------------
  // 2. Initialize MCP Client (Stdio Transport)
  // ---------------------------------------------------------
  // We use MultiServerMCPClient to manage the stdio subprocess.
  // This example connects to the @zereight/mcp-gitlab.
  const mcpClient = new MultiServerMCPClient({
    filesystem: {
      transport: "stdio",
      command: "npx",
      // Arguments to launch the MCP server subprocess
      args: ["-y", "@zereight/mcp-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "xxx",
        "GITLAB_API_URL": "xxx",
        "GITLAB_READ_ONLY_MODE": "true"
      }
    },
  });

  // Automatically perform handshake and convert MCP tools to LangChain tools
  const tools = await mcpClient.getTools();
  console.log(`🛠️  Connected to MCP. Loaded tools: ${tools.map((t) => t.name).join(", ")}`);

  // ---------------------------------------------------------
  // 3. Ingest Code Context (using Repomix)
  // ---------------------------------------------------------
  // From the Report, we can get the project_name, affected_from_nodes(from_node of the affecatedConnections),
  // source_branch, target_branch.
  const codeContext = `The project_name is ${project_name}, the affected_from_nodes are ${affected_from_nodes}, the source_branch is ${source_branch}, the target_branch is ${target_branch}.`;

  // ---------------------------------------------------------
  // 4. Initialize Agent with OpenAI Compatible API
  // ---------------------------------------------------------
  const llm = new ChatOpenAI({
    model: MODEL_NAME,
    apiKey: OPENAI_API_KEY,
    configuration: {
      baseURL: OPENAI_BASE_URL,
    },
    temperature: 0,
  });

  // Create a ReAct agent that can reason and call tools
  const agent = createReactAgent({
    llm,
    tools,
  });

  // ---------------------------------------------------------
  // 5. Execution: Instruction + Context
  // ---------------------------------------------------------
  const instruction = "You are a senior frontend developer, you have lots of experience in the React and Web development. You are now need to review the given merge request and the potential impacted code from other projects which depends on the changed code, this dependency is comes from static analysis, mainly consists of these types: 1. ES6 import/export, 2. global variables, local storage, session storage read/write, 3. events. 4. URL parameters. The changed code may be a part of the call stack of the dependency. The review process you need to do need to following these steps:
  1. using the gitlab_mcp to get the project_id by list_projects(search: project_name, per_page: 1)
  2. using the gitlab_mcp to get the merge_request_id by list_merge_requests(project_id: project_id, target_branch: target_branch, source_branch: source_branch, per_page: 1)
  3. using the gitlab_mcp to get the merge_request_content by get_merge_request_diffs(project_id: project_id, merge_request_iid: merge_request_id, view: "inline")
  4. using the gitlab_mcp to get the affected_project_ids by list_projects(search: affected_from_nodes.map(n => n.projectName))
  5. using the gitlab_mcp to get the affected_file_content by get_file_contents(project_id: affected_project_id, file_path: affected_from_node.relativePath + affected_from_node.startLine, ref: affected_from_node.branch)

  6. based on the merge_request_content and affected_file_content you need to output a code change impaction report(for each affected_from_nodes)
     the report are foucsed on the impaction on the dependency, and suggestion on how to prevent the impaction. And give a summary at businesses level
     for what functionalities may impacted
  7. your report should be a JSON format which stands for:
{
    "success": boolean,
    "impaction": string, // a summary at businesses level for what functionalities may impacted
    "level": "low" | "medium" | "high", // the severity of the impaction
    "suggestion": string, // the suggestion on how to prevent the impaction
    "message": string // other message may help the user to understand the impaction
}
  8. if any of the step failed, like failed to get the project id, you should also output the report, but with success: false, and the message should be the error message 
  ";
  
  console.log("\n🤖 Agent executing...");
  
  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: `
Context:
${codeContext}

Instruction:
${instruction}
        `,
      },
    ],
  });

  // ---------------------------------------------------------
  // 6. Output Result
  // ---------------------------------------------------------
  const finalResponse = result.messages[result.messages.length - 1].content;
  console.log("\n✅ Result:\n", finalResponse);

  // Cleanup: Kill the MCP subprocess
  await mcpClient.close();
}

main().catch(console.error);
```