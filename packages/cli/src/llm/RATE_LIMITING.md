## Rate Limiting

### Preventing 429 Errors

To avoid "Too Many Requests" errors from your LLM provider, the system includes a built-in rate limiter:

```bash
export LLM_REQUESTS_PER_MINUTE=60  # Default
```

### How It Works

The rate limiter ensures requests are spaced evenly across the minute:
- **60 RPM**: Wait 1000ms between requests
- **30 RPM**: Wait 2000ms between requests
- **120 RPM**: Wait 500ms between requests

### Provider-Specific Limits

#### OpenAI
- **Free tier**: 3 RPM → `export LLM_REQUESTS_PER_MINUTE=3`
- **Tier 1**: 500 RPM → `export LLM_REQUESTS_PER_MINUTE=500`
- **Tier 2**: 5000 RPM → `export LLM_REQUESTS_PER_MINUTE=5000`

#### Anthropic Claude
- **Default**: 50 RPM → `export LLM_REQUESTS_PER_MINUTE=50`
- **Higher tier**: 2000 RPM → `export LLM_REQUESTS_PER_MINUTE=2000`

#### Local Models (Ollama, LM Studio)
- No limits → `export LLM_REQUESTS_PER_MINUTE=999999`

### Batch Processing Behavior

When multiple batches are needed:

**Without Rate Limiting** (Old Behavior):
```
Batch 1, 2, 3... all sent in parallel
Risk: 429 error if too many requests
```

**With Rate Limiting** (New Behavior):
```
09:00:00.000 - Batch 1 starts
09:00:01.000 - Batch 2 starts (waited 1s)
09:00:02.000 - Batch 3 starts (waited 1s)
```

### Debug Output

When rate limiting is active, you'll see:
```
⏱️  Rate limit: waiting 1000ms before next request
Starting batch 2/5...
⏱️  Rate limit: waiting 500ms before next request
Starting batch 3/5...
```

### Optimization Tips

**For Speed** (if your API allows):
```bash
export LLM_REQUESTS_PER_MINUTE=500
```

**For Free Tiers**:
```bash
export LLM_REQUESTS_PER_MINUTE=3
```

**For Safety** (avoid hitting limits):
```bash
# Set to 80% of your actual limit
# If limit is 500 RPM, set to 400
export LLM_REQUESTS_PER_MINUTE=400
```

### Impact on Performance

With batching + rate limiting:
- **5 batches at 60 RPM**: ~5 seconds total
- **10 batches at 30 RPM**: ~20 seconds total
- **3 batches at 120 RPM**: ~1.5 seconds total

The system prioritizes stability over speed, but you can adjust based on your API tier.
