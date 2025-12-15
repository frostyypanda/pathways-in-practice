# SMILES Extractor - Cost Optimization Guide

**Last Updated:** 2025-12-15

## Current Baseline

Using **gemini-2.5-flash** (standard API):
- **60,000 steps:** ~$324 (simple) to ~$516 (complex)
- Image tokens: ~1,290 tokens per 1024x1024 image
- Prompt: ~1,500 tokens

---

## Strategy 1: Batch API (50% Discount)

### Overview

Google's Gemini Batch API processes requests asynchronously at **50% of standard cost**.

| Mode | Cost per 1M tokens | 60K Steps Cost |
|------|-------------------|----------------|
| Standard (real-time) | $0.10 input, $0.40 output | ~$324 |
| **Batch Mode** | $0.05 input, $0.20 output | **~$162** |

**Savings: $162 for 60K steps (50%)**

### How It Works

1. Package requests into JSONL file
2. Upload to Gemini Files API
3. Submit batch job
4. Wait up to 24 hours (usually much faster)
5. Download results

### Implementation

```python
from google import genai
import json

client = genai.Client()

# 1. Create JSONL file with requests
requests = []
for step in steps_to_process:
    requests.append({
        "key": f"synthesis_{step['id']}_step_{step['num']}",
        "request": {
            "contents": [{
                "parts": [
                    {"inline_data": {"mime_type": "image/png", "data": step['image_base64']}},
                    {"text": step['prompt_text']}
                ]
            }],
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]}
        }
    })

# Write to JSONL
with open("batch_requests.jsonl", "w") as f:
    for req in requests:
        f.write(json.dumps(req) + "\n")

# 2. Upload file
uploaded_file = client.files.upload(file="batch_requests.jsonl")

# 3. Create batch job
batch_job = client.batches.create(
    model="gemini-2.5-flash",
    src=uploaded_file.name,
    config={"display_name": "smiles-extraction-batch"}
)
print(f"Created batch job: {batch_job.name}")

# 4. Poll for completion
import time
while True:
    job = client.batches.get(name=batch_job.name)
    if job.state.name in ('JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED'):
        break
    print(f"Status: {job.state.name}")
    time.sleep(60)

# 5. Download results
if job.state.name == 'JOB_STATE_SUCCEEDED':
    results = client.files.download(file=job.dest.file_name)
    for line in results.decode('utf-8').splitlines():
        result = json.loads(line)
        print(f"{result['key']}: {result['response']}")
```

### Batch API Limits

| Limit | Value |
|-------|-------|
| Max requests per batch | 200,000 |
| Max file size | 1GB (JSONL) or 2GB |
| Target turnaround | 24 hours |
| Actual turnaround | Usually 1-6 hours |

### Best Practices

- **Combine jobs**: One batch of 60K requests > 600 batches of 100 requests
- **Include images inline**: Use base64 encoding in the JSONL
- **Monitor status**: Poll every 60 seconds
- **Handle failures**: Partial results are returned if some requests fail

---

## Strategy 2: Image Optimization (Up to 85% Token Reduction)

### The Problem

Gemini tokenizes images based on resolution:
- 1024x1024 image = **1,290 tokens** (~$0.00013 per image)
- Higher resolution = more tokens (quadratic scaling)

Our chemistry screenshots are often larger than needed for AI analysis.

### The Solution

Resize images before sending to API. AI vision models perform equally well on smaller images for most tasks.

### Optimal Dimensions for Chemistry Screenshots

| Task | Recommended Size | Tokens | Savings |
|------|-----------------|--------|---------|
| Original (typical) | 1920x1080 | ~2,500 | baseline |
| **Recommended** | 768x432 | ~580 | **77%** |
| Aggressive | 512x288 | ~260 | **90%** |

### Implementation

```python
from PIL import Image
import io
import base64

def optimize_image_for_llm(image_path: str, max_dimension: int = 768, quality: int = 85) -> str:
    """
    Optimize image for LLM processing.

    Args:
        image_path: Path to original image
        max_dimension: Maximum width or height (default 768px)
        quality: JPEG quality 1-100 (default 85)

    Returns:
        Base64 encoded optimized image
    """
    with Image.open(image_path) as img:
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        # Calculate new dimensions maintaining aspect ratio
        width, height = img.size
        if width > height:
            if width > max_dimension:
                new_width = max_dimension
                new_height = int(height * (max_dimension / width))
            else:
                new_width, new_height = width, height
        else:
            if height > max_dimension:
                new_height = max_dimension
                new_width = int(width * (max_dimension / height))
            else:
                new_width, new_height = width, height

        # Resize with high-quality resampling
        if (new_width, new_height) != (width, height):
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Save to bytes with JPEG compression
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        buffer.seek(0)

        return base64.b64encode(buffer.read()).decode('utf-8')

# Usage
optimized_b64 = optimize_image_for_llm("sequence_01.png", max_dimension=768, quality=85)
```

### Quality vs Cost Tradeoffs

| Setting | File Size | Tokens | Quality Impact |
|---------|-----------|--------|----------------|
| 1024px, quality=95 | ~200KB | ~1,290 | None |
| **768px, quality=85** | ~80KB | ~580 | Minimal |
| 512px, quality=85 | ~40KB | ~260 | Minor text blur |
| 512px, quality=75 | ~25KB | ~200 | Noticeable |

**Recommendation**: Use 768px, quality=85 for chemistry screenshots. Text remains readable, structures are clear.

### Testing Before Production

Always validate on a sample before processing 60K images:

```python
# Test on 100 images with different settings
settings_to_test = [
    {"max_dimension": 1024, "quality": 95},  # baseline
    {"max_dimension": 768, "quality": 85},   # recommended
    {"max_dimension": 512, "quality": 85},   # aggressive
]

for settings in settings_to_test:
    # Run same prompt, compare SMILES output quality
    pass
```

---

## Strategy 3: Implicit Caching (Automatic, Free)

### How It Works

Gemini 2.5 models have **implicit caching** enabled by default:
- Minimum: 1,024 tokens for gemini-2.5-flash
- Discount: 90% on cached tokens (doesn't stack with batch discount)
- Automatic: No code changes needed

### When It Helps

- Repeated requests with **same prefix** (system prompt + similar content)
- Requests sent **close together in time** (within minutes)
- Large shared context (not applicable for our small prompt)

### Our Situation

Our prompt is only ~1,500 tokens, barely above the 1,024 minimum. Caching benefit is minimal for standard API but **implicit caching works automatically in Batch Mode**.

---

## Combined Strategy: Maximum Savings

### Best Approach for 60K Steps

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| Batch API | 50% | Use JSONL batch processing |
| Image optimization (768px) | 40-50% on image tokens | Resize before upload |
| **Combined** | **~60-65%** | Both strategies together |

### Cost Projection

| Approach | 60K Steps Cost | Savings |
|----------|---------------|---------|
| Current (standard API, full images) | ~$324 | baseline |
| Batch API only | ~$162 | 50% |
| Image optimization only | ~$200 | 38% |
| **Batch + Image optimization** | **~$115-130** | **60-65%** |

### Implementation Checklist

1. [ ] Add image optimization to extract.py
2. [ ] Create batch processing script (batch_extract.py)
3. [ ] Test on 100 images to validate quality
4. [ ] Run full 60K batch

---

## Quick Reference: Gemini 2.5 Flash Pricing

### Standard API
| Type | Price per 1M tokens |
|------|---------------------|
| Input (text/image/video) | $0.10 |
| Output | $0.40 |

### Batch API (50% off)
| Type | Price per 1M tokens |
|------|---------------------|
| Input (text/image/video) | $0.05 |
| Output | $0.20 |

### Image Token Formula
```
tokens = ceil(width / 768) * ceil(height / 768) * 258
```
Approximate: 1024x1024 = 1,290 tokens

---

---

## Strategy 4: Reasoning Effort - DO NOT USE FOR COMPLEX CHEMISTRY

### What is `reasoning_effort`?

Gemini 2.5 Flash is a "thinking model" that reasons before responding. You can control how much it thinks via the `reasoning_effort` parameter (or `thinking_budget` in native API).

- **Max thinking budget**: 24,576 tokens
- **Default (no parameter)**: Model decides automatically based on task complexity

### Our Testing Results (Step 12 - Complex Polycyclic Structure)

| Setting | Thinking Tokens | % of Max | Product SMILES | Quality |
|---------|----------------|----------|----------------|---------|
| **default (none)** | 21,292 | 86.6% | Correct stereochemistry | ✅ CORRECT |
| `reasoning_effort="high"` | 3,295 | 13.4% | Wrong ring structure | ❌ WRONG |
| `reasoning_effort="medium"` | 1,416 | 5.8% | Completely wrong | ❌ WRONG |
| `reasoning_effort="low"` | 878 | 3.6% | Wrong stereochemistry | ❌ WRONG |

### Cost Comparison

| Setting | Cost (Step 12) | 60K Projection | Quality |
|---------|---------------|----------------|---------|
| **default** | $0.055 | $3,300 | ✅ Correct |
| high | $0.010 | $600 | ❌ Wrong |
| medium | $0.005 | $330 | ❌ Wrong |
| low | $0.005 | $285 | ❌ Wrong |

### Key Finding: DON'T LIMIT REASONING FOR COMPLEX CHEMISTRY

The model NEEDS ~21K thinking tokens to correctly analyze complex polycyclic structures with multiple stereocenters. Constraining it to even "high" (3.3K tokens) breaks the output.

**The `reasoning_effort` parameter sets a MAXIMUM cap, not a minimum.** Even "high" is only 13% of what the model needs for complex tasks.

### When to Use `reasoning_effort`

| Task Complexity | Recommendation |
|-----------------|----------------|
| Simple (step 1, basic protection) | Could try `reasoning_effort="medium"` |
| Complex (polycycles, many stereocenters) | **DO NOT SET** - let model think freely |
| Unknown | **DO NOT SET** - safer to let model decide |

### Code Example

```python
# WRONG - constrains thinking, breaks complex chemistry
response = completion(model="gemini/gemini-2.5-flash", messages=messages, reasoning_effort="high")

# CORRECT - let model think as much as needed
response = completion(model="gemini/gemini-2.5-flash", messages=messages)
```

### Native Gemini API Equivalent

```python
from google import genai

# WRONG - limited thinking
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt,
    config=genai.types.GenerateContentConfig(
        thinking_config=genai.types.ThinkingConfig(thinking_budget=3000)
    )
)

# CORRECT - unlimited thinking (up to 24K)
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt
    # No thinking_config = model decides
)
```

---

## Final Cost Projections (60K Steps)

### Simple Structures (Step 1 type)
| Strategy | Cost |
|----------|------|
| Standard API | ~$400 |
| Batch API (50% off) | ~$200 |
| Batch + Image optimization | ~$150 |

### Complex Structures (Step 12 type)
| Strategy | Cost |
|----------|------|
| Standard API (full thinking) | ~$3,300 |
| Batch API (50% off) | ~$1,650 |

### Mixed (Realistic - 80% simple, 20% complex)
| Strategy | Cost |
|----------|------|
| Standard API | ~$980 |
| Batch API (50% off) | ~$490 |

**Note:** Cannot use `reasoning_effort` to reduce costs without sacrificing quality on complex structures.

---

## References

- [Gemini Batch API Documentation](https://ai.google.dev/gemini-api/docs/batch-api)
- [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Context Caching](https://ai.google.dev/gemini-api/docs/caching)
- [Vertex AI Batch Inference](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/batch-prediction-gemini)
- [Gemini 2.5 Thinking Models](https://developers.googleblog.com/en/start-building-with-gemini-25-flash/) - thinking budget info
