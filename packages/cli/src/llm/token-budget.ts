import debug, { error } from '../utils/debug'
import { Tiktoken } from 'js-tiktoken/lite'
import cl100k_base from 'js-tiktoken/ranks/cl100k_base'
import { LocalNode } from '../server-types'

/**
 * Token budget management for LLM context
 * Implements dynamic context building with batching and smart window strategies
 */

// Initialize tokenizer with cl100k_base (GPT-4, GPT-3.5-turbo)
let encoder: Tiktoken | null = null

function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = new Tiktoken(cl100k_base)
  }
  return encoder
}

// Model limits (configurable via environment variables)
export const MODEL_MAX_TOKENS = parseInt(process.env.LLM_MODEL_MAX_TOKENS || '128000', 10)
export const SAFE_BUFFER = parseInt(process.env.LLM_SAFE_BUFFER || '4000', 10)
export const SYSTEM_PROMPT_COST = parseInt(process.env.LLM_SYSTEM_PROMPT_COST || '2000', 10)
export const AVAILABLE_TOKENS = MODEL_MAX_TOKENS - SAFE_BUFFER - SYSTEM_PROMPT_COST

// Smart window default size
export const DEFAULT_WINDOW_SIZE = parseInt(process.env.LLM_WINDOW_SIZE || '100', 10)

/**
 * Count tokens in text using js-tiktoken
 * Falls back to simple estimation if tokenizer fails
 */
export function countTokens(text: string): number {
  try {
    const enc = getEncoder()
    const tokens = enc.encode(text)
    return tokens.length
  } catch (err) {
    // Fallback: Simple estimation (works reasonably well for English/code)
    // Average is ~4 characters per token for English text and code
    error('Tokenizer error, using fallback estimation: %o', err)
    return Math.ceil(text.length / 4)
  }
}

/**
 * Extract a smart window of lines around a target line
 * Used when individual files are too large to include in full
 */
export function getSmartWindow(
  content: string,
  targetLine: number,
  windowSize: number = DEFAULT_WINDOW_SIZE,
): string {
  const lines = content.split('\n')
  const start = Math.max(0, targetLine - windowSize)
  const end = Math.min(lines.length, targetLine + windowSize)

  const beforeTruncated = start > 0
  const afterTruncated = end < lines.length

  const snippet = lines.slice(start, end)

  // Add line numbers and truncation markers
  const numberedSnippet = snippet
    .map((line, idx) => {
      const lineNum = (start + idx + 1).toString().padStart(4, ' ')
      return `${lineNum}: ${line}`
    })
    .join('\n')

  const before = beforeTruncated ? `... (${start} lines truncated) ...\n` : ''
  const after = afterTruncated ? `\n... (${lines.length - end} lines truncated) ...` : ''

  return before + numberedSnippet + after
}

/**
 * Context item for batching
 */
export interface ContextItem {
  fromNode: LocalNode
  toNode: LocalNode
  projectID: string
  changedLines?: string[]
  impactedCodeContent: string
  dependentCodeContent: string
}

/**
 * Context batch for LLM processing
 */
export interface ContextBatch {
  items: ContextItem[]
  estimatedTokens: number
}

/**
 * Calculate batches based on token budget
 * Implements Priority A (full content), B (batching), and C (smart window)
 */
export function calculateBatches(diffContent: string, items: ContextItem[]): ContextBatch[] {
  const diffTokens = countTokens(diffContent)
  const batches: ContextBatch[] = []
  let currentBatch: ContextItem[] = []
  let currentBatchTokens = diffTokens

  debug(
    `Token Budget: Model=${MODEL_MAX_TOKENS}, Available=${AVAILABLE_TOKENS}, Diff=${diffTokens}`,
  )

  for (const item of items) {
    // Calculate content for this item
    let dependentContent = item.dependentCodeContent
    let impactedContent = item.impactedCodeContent

    // Check if individual files are oversized (Priority C: Smart Window)
    const dependentTokens = countTokens(dependentContent)
    const impactedTokens = countTokens(impactedContent)

    // If a single file is bigger than available tokens, apply smart window
    if (dependentTokens > AVAILABLE_TOKENS - diffTokens - 1000) {
      debug(
        `⚠️  File ${item.toNode.relativePath} is oversized (${dependentTokens} tokens), applying smart window`,
      )
      dependentContent = getSmartWindow(
        dependentContent,
        item.toNode.startLine,
        DEFAULT_WINDOW_SIZE,
      )
    }

    if (impactedTokens > AVAILABLE_TOKENS - diffTokens - 1000) {
      debug(
        `⚠️  File ${item.fromNode.relativePath} in ${item.fromNode.projectName} is oversized (${impactedTokens} tokens), applying smart window`,
      )
      impactedContent = getSmartWindow(
        impactedContent,
        item.fromNode.startLine,
        DEFAULT_WINDOW_SIZE,
      )
    }

    // Calculate actual tokens for potentially windowed content
    const itemDependentTokens = countTokens(dependentContent)
    const itemImpactedTokens = countTokens(impactedContent)
    const changedLinesTokens = item.changedLines ? countTokens(item.changedLines.join('\n')) : 0
    const itemTotalTokens = itemDependentTokens + itemImpactedTokens + changedLinesTokens + 100 // +100 for XML overhead

    // Priority B: Check if adding this item would overflow current batch
    if (currentBatchTokens + itemTotalTokens > AVAILABLE_TOKENS && currentBatch.length > 0) {
      debug(
        `📦 Batch full (${currentBatchTokens} tokens), creating new batch. New item needs ${itemTotalTokens} tokens.`,
      )
      batches.push({
        items: currentBatch,
        estimatedTokens: currentBatchTokens,
      })
      currentBatch = []
      currentBatchTokens = diffTokens // New batch also includes diff
    }

    // Add item to current batch (Priority A: Full content when possible)
    currentBatch.push({
      ...item,
      dependentCodeContent: dependentContent,
      impactedCodeContent: impactedContent,
    })
    currentBatchTokens += itemTotalTokens
  }

  // Push the last batch
  if (currentBatch.length > 0) {
    batches.push({
      items: currentBatch,
      estimatedTokens: currentBatchTokens,
    })
  }

  debug(
    `🚀 Split into ${batches.length} batch(es): ${batches.map((b, i) => `Batch ${i + 1}: ${b.items.length} items, ~${b.estimatedTokens} tokens`).join('; ')}`,
  )

  return batches
}
