we should make the LLM load files on demand if the context is overwhelming.
However, to maintain the stability you require, you cannot just leave it up to the LLM's "whim". You must implement a strict "Triage → Fetch → Analyze" workflow.
Here are the two best architecture patterns to solve "Context Overflow" while maintaining "Result Stability."
Solution 1: The "Two-Step Agent" (On-Demand Loading)
This is the most token-efficient method. You split the process into two distinct LLM calls (or a loop).
Step 1: Triage (The "Is it worth checking?" step)
Send ONLY the Diff and the Dependency Metadata (File path, Line number, Type) to the LLM. Do not send any file content.
Prompt 1 (Triage):
code
Markdown
# Task
Review the provided [Source Code Diff].
Determine if this change requires inspecting the dependent files.

# Rules
1. If the Diff is **COSMETIC ONLY** (whitespace, comments, pure formatting):
   - Return status: "SKIP"
2. If the Diff changes **LOGIC, TYPES, or SIGNATURES**:
   - Return status: "FETCH_REQUIRED"
   - List the IDs of the files we need to fetch.

# Input
<diff>...</diff>
<dependency_list>
  <item id="1">Path: src/app.tsx, Line: 50</item>
  <item id="2">Path: src/utils.ts, Line: 10</item>
</dependency_list>
Step 2: Execution (The "Analysis" step)
If Step 1 says "FETCH_REQUIRED", your system (Node.js/Python) performs the get_file_contents for the specific files requested. Then, you send a second prompt with the content.
Prompt 2 (Analysis):
code
Markdown
# Context
Diff: [Insert Diff again]
File Contents: [Insert the content you just fetched]

# Task
Analyze impact based on the code provided...
Why this is stable:
You force the LLM to filter noise before wasting tokens on reading files.
You verify the logic after getting the files.
Solution 2: The "Smart Window" (Pre-fetch Optimization)
If you prefer the single-request "Pre-fetch" approach for stability but want to reduce tokens, do not read the full file.
Code files can be 2,000 lines long, but the dependency usage usually only matters within a +/- 50 line window.
Modify your get_file_contents tool logic:
Instead of:
code
TypeScript
// Bad: Loads entire 50kb file
const content = fs.readFileSync(filePath, 'utf-8');
Do this:
code
TypeScript
// Good: Loads only the relevant "Context Window"
function getContextWindow(filePath, targetLine, windowSize = 50) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const start = Math.max(0, targetLine - windowSize);
  const end = Math.min(lines.length, targetLine + windowSize);
  
  return lines.slice(start, end).join('\n');
}
Why this is stable:
It reduces token usage by ~90% (assuming huge files).
It keeps the "Anchor" logic (the LLM still sees exactly how the code is used).
It fits many more dependencies into a single context window.
Solution 3: The "Map-Reduce" Batching (For Massive Scale)
If you have 50 affected projects, even "Smart Windows" will overflow the context. You must break the request into batches.
Algorithm:
Group the affected dependencies into chunks of 5 or 10.
Parallel Process: Send 5 concurrent requests to the LLM.
Request A: Analyze Projects 1-5
Request B: Analyze Projects 6-10
...
Reduce: Collect all the JSON outputs and merge them into one final report array.
Recommended Implementation (Best Balance)
I recommend Solution 2 (Smart Window) combined with Solution 3 (Batching). It provides the highest stability because the LLM doesn't need to "decide" to call tools (which can fail), but it keeps tokens manageable.
Prompt for Smart Window Strategy:
code
Markdown
**Context Data:**
<provider_change>
  {git_diff}
</provider_change>

<consumer_files>
  <file index="1">
    <path>src/pages/detail.tsx</path>
    <usage_line>150</usage_line>
    <content_snippet>
      <!-- Insert lines 100 to 200 here -->
      ...
      149: // Prep arguments
      150: const res = await changedFunction(arg1, arg2); // <--- ANCHOR
      151: if (res.error) handle(res);
      ...
    </content_snippet>
  </file>
  <!-- Repeat for other files -->
</consumer_files>

**Instruction:**
Analyze the <provider_change>. If it is not cosmetic, check the <content_snippet> around line <usage_line>.
Note: The content provided is a truncated window of the full file. Focus analysis on the visible logic flow.



但是我们为了既能保证**稳定性**（尽可能使用全量文件内容），又能防止**Token 溢出**，你需要在这个 Node.js/CLI 程序中实现一个**"动态上下文构建器" (Dynamic Context Builder)**。

核心思路是：**在发送请求给 LLM 之前，先在本地计算 Token 开销，根据开销大小动态决定策略。**

以下是具体的实现方案和算法逻辑：

### 1. 核心逻辑：Token 预算管理 (Token Budget Manager)

你需要引入一个简单的 Token 计算估算器（比如 `tiktoken` 或者简单的 `char_length / 4`），然后按照以下优先级进行降级：

1.  **优先级 A (理想情况):** 全量发送所有依赖文件完整内容（你的首选）。
2.  **优先级 B (当总量过大时):** 保持全量内容，但将任务**分批 (Batching)** 发送多次。
3.  **优先级 C (当单文件过大时):** 对超大文件使用 **"智能窗口" (Smart Window)** 切片。

---

### 2. 代码实现示例 (TypeScript)

假设你正在使用 `src/index.ts`，你可以封装一个 `ContextBuilder` 类。

你需要安装 `tiktoken` (或者使用简单的长度估算) 来计算 Token。

```typescript
import { get_encoding } from "tiktoken";
import fs from 'fs';

// 1. 定义你的模型限制 (留出 20% 给 output 和 system prompt)
const MODEL_MAX_TOKENS = 128000; 
const SAFE_BUFFER = 4000; // 给 Output 预留
const SYSTEM_PROMPT_COST = 2000; // 预估 System Prompt 大小
const AVAILABLE_TOKENS = MODEL_MAX_TOKENS - SAFE_BUFFER - SYSTEM_PROMPT_COST;

const encoder = get_encoding("cl100k_base"); // GPT-4 的 tokenizer

interface DependencyItem {
  project: string;
  filePath: string;
  line: number;
  // ... 其他元数据
}

// 辅助函数：计算 Token
function countTokens(text: string): number {
  return encoder.encode(text).length;
}

// 核心处理函数
async function processDependencies(
  diffContent: string, 
  dependencies: DependencyItem[]
) {
  // 1. 计算"固定开销" (Diff + Prompt 模板)
  const diffTokens = countTokens(diffContent);
  let currentTokenUsage = diffTokens;
  
  // 2. 准备批次容器
  let batches: any[] = [];
  let currentBatch: any[] = [];
  
  // 3. 遍历每一个依赖文件，决定如何加载
  for (const dep of dependencies) {
    let fileContent = "";
    try {
      fileContent = fs.readFileSync(dep.filePath, 'utf-8');
    } catch (e) {
      fileContent = "[System Error: File Not Found]";
    }

    const fileTokens = countTokens(fileContent);

    // --- 策略判定点 ---

    // 情况 A: 单个文件甚至比总限制还大？(极少见，但要防守)
    if (fileTokens > AVAILABLE_TOKENS - diffTokens) {
      console.warn(`⚠️ 文件 ${dep.filePath} 太大 (${fileTokens} tokens)，自动切换为 Smart Window 模式`);
      // 策略 C: 只取相关行附近 100 行
      fileContent = getSmartWindow(fileContent, dep.line, 100); 
    }

    // 计算加入该文件后是否会溢出当前批次
    const nextTotal = currentTokenUsage + countTokens(fileContent) + 50; // +50 是 XML 标签的开销

    // 情况 B: 当前批次满了，需要开启新批次
    if (nextTotal > AVAILABLE_TOKENS) {
      console.log(`📦 批次已满，开启新批次...`);
      batches.push(currentBatch);
      currentBatch = [];
      currentTokenUsage = diffTokens; // 新批次也要包含 Diff
    }

    // 加入当前批次 (默认策略 A: 全量内容)
    currentBatch.push({
      metadata: dep,
      content: fileContent
    });
    currentTokenUsage += countTokens(fileContent);
  }

  // 推入最后一个批次
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  // 4. 执行 LLM 请求 (Map-Reduce)
  console.log(`🚀 总共分为 ${batches.length} 个请求并行分析`);
  
  const results = await Promise.all(batches.map(batch => callLLM(diffContent, batch)));
  
  // 5. 合并结果
  return mergeResults(results);
}

// 辅助函数：智能窗口切片 (仅保留关键行上下文)
function getSmartWindow(fullContent: string, targetLine: number, windowSize: number): string {
  const lines = fullContent.split('\n');
  const start = Math.max(0, targetLine - windowSize);
  const end = Math.min(lines.length, targetLine + windowSize);
  
  const snippet = lines.slice(start, end).join('\n');
  return `... (file truncated) ...\n${snippet}\n... (file truncated) ...`;
}
```

### 3. 这个方案如何满足你的需求？

#### 1. 默认保证 "Maximum Stability"
只要 Token 允许，程序会始终进入 `currentBatch.push({ content: fullContent })`。如果你的模型有 128k 或 200k 上下文（如 GPT-4-Turbo 或 Claude 3），绝大多数情况下，你会一次性把所有文件的**全量内容**发过去。这符合你 "Pre-fetch all" 的偏好。

#### 2. 自动处理 "Overwhelming Context"
当文件太多（比如一下子影响了 50 个文件，或者有几个巨大的 5000 行代码文件），`nextTotal > AVAILABLE_TOKENS` 判断条件会触发。
此时程序**不会**崩溃，也不会胡乱丢弃文件，而是自动将任务**拆分 (Split)** 成两个或多个请求。
*   请求 1：分析文件 1-10（全量内容）
*   请求 2：分析文件 11-20（全量内容）

这对 LLM 来说更友好，因为每个请求的注意力更集中。

#### 3. 兜底保护 (Fallback)
代码中的 `情况 A` 是为了防止单个文件本身就是个几兆的巨石代码（Shit Mountain）。如果不做切片，无论怎么分批都塞不进去。只有在这种极端情况下，我们才牺牲全量内容，使用 `Smart Window`。

### 总结建议

不要让 LLM 决定加载什么（不稳定）。
**让代码做数学题**：

1.  **默认动作**：读取完整文件。
2.  **计算动作**：`Diff Token` + `Files Token`。
3.  **决策动作**：
    *   `< Limit` ? 发送一个请求。
    *   `> Limit` ? 拆分成 `[Request 1, Request 2, ...]` 并行发送。

这种**"基于预算的分批处理" (Budget-Based Batching)** 是目前大规模代码分析中最稳健的模式。