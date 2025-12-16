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

## Pending Batches

| Batch | IDs | Requests | Submitted | Job Name |
|-------|-----|----------|-----------|----------|
| 7 | 4909-5392 | 6,152 | 2025-12-16 19:05 | `batches/y5i1360gqy0e89maekquvekh3blaj8a36jm7` |
| 8 | 5393-5855 | 6,538 | 2025-12-16 19:50 | `batches/x1c8fyjql6p97mveky0bmt9ixv0tbtcln56j` |

## Planned Batches

| Batch | IDs | Command |
|-------|-----|---------|
| 9 | 5856-6337 | `python batch_submit.py --from-id 5856 --to-id 6337 --build-only` |
| 10 | 6338-6881 | `python batch_submit.py --from-id 6338 --to-id 6881 --build-only` |
| 11 | 6882-7305 | `python batch_submit.py --from-id 6882 --to-id 7305 --build-only` |
| 12 | 7306-7428 | `python batch_submit.py --from-id 7306 --to-id 7428 --build-only` |

### Notes
- Test batch had overnight delay (manually collected next day)
- Batches 1-2 processed in ~55 min on average
- ~99.6% success rate (JSON parse errors from invalid escape sequences)

## Progress Summary

| Metric | Count |
|--------|-------|
| Syntheses processed | 1,505 |
| Total steps in DB | 25,174 |
| Remaining syntheses | 2,123 |
| Estimated remaining steps | ~33,600 |
| Batches remaining | 6 (at 400/batch) |

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
