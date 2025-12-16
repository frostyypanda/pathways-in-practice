# LLM Pricing Comparison for SMILES Extraction

Last updated: December 2025

## Vision Models with Prompt Caching Support

All models below support vision (image input) and prompt caching.

### Pricing per Million Tokens

| Provider | Model | Input | Cached Input | Output | Cache Discount |
|----------|-------|-------|--------------|--------|----------------|
| **Anthropic** | Claude 3.5 Sonnet | $3.00 | $0.30 | $15.00 | **90%** |
| **Anthropic** | Claude 3.5 Haiku | $1.00 | $0.10 | $5.00 | **90%** |
| **OpenAI** | GPT-4o | $5.00 | $2.50 | $20.00 | 50% |
| **OpenAI** | GPT-4o Mini | $0.60 | $0.30 | $2.40 | 50% |
| **Google** | Gemini 2.5 Flash | $0.30 | ~$0.075* | $2.50 | ~75% |
| **Google** | Gemini 2.5 Flash Lite | $0.10 | ~$0.025* | $0.40 | ~75% |
| **Google** | Gemini 1.5 Pro | $1.25 | ~$0.31* | $5.00 | ~75% |
| **Google** | Gemini 1.5 Flash | $0.075 | ~$0.02* | $0.30 | ~75% |

*Google charges $1.00-$4.50/M tokens/hour for cache storage (varies by model)

### LiteLLM Model Names

```python
MODELS = {
    # Anthropic
    "claude-sonnet": "anthropic/claude-3-5-sonnet-20241022",
    "claude-haiku": "anthropic/claude-3-5-haiku-20241022",

    # OpenAI
    "gpt-4o": "openai/gpt-4o",
    "gpt-4o-mini": "openai/gpt-4o-mini",

    # Google
    "gemini-2.5-flash": "gemini/gemini-2.5-flash-preview-05-20",
    "gemini-2.5-flash-lite": "gemini/gemini-2.5-flash-lite-preview-06-17",
    "gemini-1.5-flash": "gemini/gemini-1.5-flash",
    "gemini-1.5-pro": "gemini/gemini-1.5-pro",
}
```

## Cost Estimate for 200,000 Calls

Assumptions:
- Prompt: ~2,000 tokens (cached after first call)
- Image: ~500 tokens (not cached)
- Output: ~300 tokens

### Estimated Total Cost

| Model | Without Cache | With Cache | Monthly Savings |
|-------|---------------|------------|-----------------|
| Gemini 2.5 Flash Lite | ~$120 | ~$50 | $70 |
| Gemini 1.5 Flash | ~$45 | ~$20 | $25 |
| Gemini 2.5 Flash | ~$560 | ~$200 | $360 |
| GPT-4o Mini | ~$600 | ~$400 | $200 |
| Claude 3.5 Haiku | ~$1,200 | ~$400 | $800 |
| Claude 3.5 Sonnet | ~$3,600 | ~$1,200 | $2,400 |
| GPT-4o | ~$4,600 | ~$3,100 | $1,500 |

### Recommendations

**Best for cost (high volume):**
- Gemini 2.5 Flash Lite ($0.10 input / $0.40 output)
- Gemini 1.5 Flash ($0.075 input / $0.30 output)

**Best cache discount:**
- Anthropic models (90% discount on cached tokens)

**Best balance of quality/cost:**
- Claude 3.5 Haiku
- GPT-4o Mini
- Gemini 2.5 Flash

## Caching Mechanisms

### Anthropic
- Explicit `cache_control: {"type": "ephemeral"}` on content blocks
- 5-minute TTL (auto-extended on use)
- 90% discount on cached input tokens

### OpenAI
- Automatic caching for prompts >1024 tokens
- No explicit control needed
- 50% discount on cached input tokens

### Google Gemini
- Explicit context caching with TTL
- Minimum 32K tokens to cache
- Storage cost: $1.00-$4.50/M tokens/hour
- ~75% discount on cached reads

## References

- [LiteLLM Prompt Caching Docs](https://docs.litellm.ai/docs/completion/prompt_caching)
- [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [OpenAI Pricing](https://platform.openai.com/docs/pricing)
- [Google Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing)
