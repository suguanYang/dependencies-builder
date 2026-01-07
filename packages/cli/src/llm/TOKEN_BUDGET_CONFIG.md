# LLM Token Budget Configuration

The LLM module supports dynamic configuration via environment variables to adapt to different models and use cases.

## Environment Variables

### Token Budget Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_MODEL_MAX_TOKENS` | `128000` | Maximum context window of your model (e.g., 128k for GPT-4 Turbo, 200k for Claude 3 Opus) |
| `LLM_SAFE_BUFFER` | `4000` | Tokens reserved for model output/response |
| `LLM_SYSTEM_PROMPT_COST` | `2000` | Estimated tokens used by system prompt/instructions |
| `LLM_WINDOW_SIZE` | `100` | Number of lines to extract on each side of anchor line for smart window |

### Model Examples

#### GPT-4 Turbo (128k context)
```bash
export LLM_MODEL_MAX_TOKENS=128000
export LLM_SAFE_BUFFER=4000
export LLM_SYSTEM_PROMPT_COST=2000
```

#### GPT-4-32k
```bash
export LLM_MODEL_MAX_TOKENS=32000
export LLM_SAFE_BUFFER=2000
export LLM_SYSTEM_PROMPT_COST=1000
```

#### Claude 3 Opus (200k context)
```bash
export LLM_MODEL_MAX_TOKENS=200000
export LLM_SAFE_BUFFER=5000
export LLM_SYSTEM_PROMPT_COST=2000
```

#### Claude 3.5 Sonnet (200k context)
```bash
export LLM_MODEL_MAX_TOKENS=200000
export LLM_SAFE_BUFFER=8000  # Higher for better output quality
export LLM_SYSTEM_PROMPT_COST=2000
```

### Calculated Budget

The actual available tokens for context is calculated as:

```typescript
AVAILABLE_TOKENS = MODEL_MAX_TOKENS - SAFE_BUFFER - SYSTEM_PROMPT_COST
```

For default settings:
```
122000 = 128000 - 4000 - 2000
```

## Token Counting

The module uses `js-tiktoken` (lite version) with `cl100k_base` encoding, which is compatible with:
- GPT-4 models
- GPT-3.5-turbo
- text-embedding-ada-002

### Fallback Behavior

If tokenization fails for any reason, the system falls back to a simple estimation:
```typescript
estimatedTokens = Math.ceil(text.length / 4)
```

This provides reasonable accuracy (~80-90%) for English text and code.

## Batching Behavior

The system automatically adjusts based on your configuration:

### Scenario 1: Large Context Window (200k)
With Claude 3 Opus configuration, most analyses will fit in a single batch:
```bash
LLM_MODEL_MAX_TOKENS=200000
```
Result: Fewer batches, faster processing

### Scenario 2: Smaller Context Window (32k)
With GPT-4-32k, more batching will occur:
```bash
LLM_MODEL_MAX_TOKENS=32000
```
Result: More batches, but still handles large codebases

## Smart Window Configuration

You can adjust the window size for oversized files:

### Larger Window (More Context)
```bash
export LLM_WINDOW_SIZE=200  # ±200 lines
```
- More context per file
- Better analysis accuracy
- Uses more tokens

### Smaller Window (Less Context)
```bash
export LLM_WINDOW_SIZE=50   # ±50 lines
```
- Less context per file
- Fits more files per batch
- Saves tokens

## Debug Logging

Enable debug logging to see token budget decisions:

```bash
DEBUG=dms:* pnpm cli report --branch your-branch
```

You'll see output like:
```
Token Budget: Model=128000, Available=122000, Diff=500
⚠️  File src/huge.tsx is oversized (150000 tokens), applying smart window
📦 Batch full (121500 tokens), creating new batch. New item needs 5000 tokens.
🚀 Split into 2 batch(es): Batch 1: 15 items, ~75000 tokens; Batch 2: 15 items, ~75000 tokens
```

## Optimization Tips

### For Speed (Reduce API Calls)
Use larger context window models:
```bash
export LLM_MODEL_MAX_TOKENS=200000  # Claude 3
```

### For Cost (Reduce Token Usage)
Use smaller windows and buffers:
```bash
export LLM_MODEL_MAX_TOKENS=32000
export LLM_SAFE_BUFFER=2000
export LLM_WINDOW_SIZE=50
```

### For Accuracy (Maximum Context)
Use large windows with large models:
```bash
export LLM_MODEL_MAX_TOKENS=200000
export LLM_WINDOW_SIZE=200
export LLM_SAFE_BUFFER=8000
```

## Troubleshooting

### "Batch full" messages appearing too frequently
Increase your model's max tokens:
```bash
export LLM_MODEL_MAX_TOKENS=200000
```

### Files being "oversized" when they shouldn't be
Individual files are considered oversized when:
```
fileTokens > AVAILABLE_TOKENS - diffTokens - 1000
```

Solutions:
1. Increase `LLM_MODEL_MAX_TOKENS`
2. Decrease `LLM_SAFE_BUFFER` (if your model allows)
3. Accept smart window mode for very large files

### Token estimates seem inaccurate
The `js-tiktoken` library provides accurate token counting. If you see discrepancies:
1. Check that you're using the correct encoding for your model
2. Verify the library is installed: `pnpm list js-tiktoken`
3. Check debug logs for "Tokenizer error" messages (indicates fallback mode)
