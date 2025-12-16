# Batch Processing Tracking

## Model Info
- **Model**: gemini-2.5-flash
- **Mode**: Batch API (50% discount)
- **Thinking**: Dynamic (default) - **DO NOT DISABLE**
  - Tested: Dynamic thinking produces significantly better SMILES validation results
  - Model decides when/how much to think (up to 24,576 tokens)
  - Essential for accurate chemical structure reasoning
- **Pricing (batch)**:
  - Input: $0.075/1M tokens
  - Output: $0.30/1M tokens (includes thinking tokens)
  - Images: ~1500 tokens each

## Completed Batches

| Batch | Syntheses | Requests | Submitted | Collected | Duration | Success | Failed |
|-------|-----------|----------|-----------|-----------|----------|---------|--------|
| Test | 4 | 88 | 2025-12-15 21:49 | 2025-12-16 07:38 | 9h 49m | 88 | 0 |
| 1 | 100 | 1619 | 2025-12-16 09:32 | 2025-12-16 10:29 | 57m | 1612 | 7 |
| 2 | 100 | 1838 | 2025-12-16 10:55 | 2025-12-16 11:47 | 52m | 1831 | 7 |
| 3 | 100 | 1578 | 2025-12-16 11:53 | 2025-12-16 12:48 | 55m | 1570 | 8 |
| 4 (big) | 400 | 6,959 | 2025-12-16 13:09 | 2025-12-16 16:02 | 2h 53m | 6919 | 40 |
| 5 | 400 | 6,562 | 2025-12-16 14:59 | 2025-12-16 17:10 | 2h 11m | 6540 | 22 |
| 6 | 400 | 6,669 | 2025-12-16 17:26 | 2025-12-16 18:50 | 1h 24m | 6610 | 59 |
| 7 | 400 | 6,152 | 2025-12-16 19:05 | 2025-12-16 20:10 | 1h 5m | 6126 | 26 |
| 8 | 400 | 6,538 | 2025-12-16 19:50 | 2025-12-16 20:25 | 35m | 6496 | 42 |
| 9 | 400 | 6,095 | 2025-12-16 20:30 | 2025-12-16 21:15 | 45m | 6056 | 39 |
| 10 | 400 | 6,042 | 2025-12-16 20:40 | 2025-12-16 21:20 | 40m | 6008 | 34 |
| 11 | 400 | 6,824 | 2025-12-16 20:45 | 2025-12-16 21:30 | 45m | 6781 | 43 |
| 12 | 123 | 1,997 | 2025-12-16 20:50 | 2025-12-16 21:35 | 45m | 1987 | 10 |

## ✅ PROCESSING COMPLETE

### Notes
- Test batch had overnight delay (manually collected next day)
- Batches 1-2 processed in ~55 min on average
- ~99.6% success rate (JSON parse errors from invalid escape sequences)

## Progress Summary

| Metric | Count |
|--------|-------|
| Syntheses processed | 3,627 |
| Total steps in DB | 58,628 |
| Remaining syntheses | 9 |
| Batches completed | 12 |
| **Progress** | **99.8%** ✅ |

## Cost Estimation

### Actual Token Usage (from Batch 7)
| Category | Per Step | Per Batch (~6K steps) |
|----------|----------|----------------------|
| Input | 1,659 | 10.2M |
| Output | 491 | 3.0M |
| **Thinking** | **8,722** | **53.7M** |
| Total | 10,872 | 66.9M |

### Per-Batch Cost (actual)
- Input: $0.77
- Output + Thinking: $17.00
- **Total per batch: ~$18**

### Completed Cost (7 batches)
- Batches completed: 7 (Test + 1-6)
- Estimated spent: ~$90

### Projected Total Cost
- Total batches: ~12
- Estimated total cost: ~$216
- Already spent: ~$90
- Remaining (5 batches): ~$90

## Timeline Projection

At 400 syntheses per batch (~6,500 steps):
- Batches remaining: 5
- Batch API processing: ~1-2 hours each
- DB import: ~30 seconds (optimized)
- Estimated completion: Today/Tomorrow

## Commands

```bash
# List remaining batches with ID ranges
python batch_submit.py --list-batches

# Build batch file (use ID ranges - stable, won't shift)
python batch_submit.py --from-id 5856 --to-id 6337 --build-only
# Creates: batch_5856-6337.jsonl

# Submit pre-built file
python submit_file.py batch_5856-6337.jsonl

# Check batch status
python batch_collect.py --job-name "batches/XXXX" --status-only

# Download results only
python batch_collect.py --job-name "batches/XXXX" --download-only

# Import from downloaded file
python batch_collect.py --from-file results_XXXX.jsonl

# Download + import (default)
python batch_collect.py --job-name "batches/XXXX"
```
