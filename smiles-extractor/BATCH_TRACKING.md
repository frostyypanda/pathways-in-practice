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

## Pending Batches

| Batch | Syntheses | Requests | Submitted | Job Name |
|-------|-----------|----------|-----------|----------|
| 6 | 400 | 6,669 | 2025-12-16 17:26 | `batches/wy1d3cva9h9aebho3iwteilyqn4tk2mkh1rg` |

### Notes
- Test batch had overnight delay (manually collected next day)
- Batches 1-2 processed in ~55 min on average
- ~99.6% success rate (JSON parse errors from invalid escape sequences)

## Progress Summary

| Metric | Count |
|--------|-------|
| Syntheses processed | 1,105 |
| Total steps in DB | 18,564 |
| Remaining syntheses | 2,523 |
| Estimated remaining steps | ~40,800 |
| Batches remaining | 7 (at 400/batch) |

## Cost Estimation

### Per-Step Estimate
- Input tokens per step: ~2,500 (prompt + image)
- Output tokens per step: ~500 (JSON response)
- Cost per step: ~$0.00034

### Completed Cost
- Steps processed: 18,564
- Estimated cost: ~$6.30

### Projected Total Cost
- Total steps: ~59,300
- Estimated total cost: ~$20
- Already spent: ~$6.30
- Remaining: ~$14

## Timeline Projection

At 400 syntheses per batch (~6,500 steps):
- Batches remaining: 8
- Batch API processing: ~55 min each
- DB import with batched inserts: ~5-10 min (after optimization)
- Estimated completion: 1-2 more days

## Commands

```bash
# Check batch status
python batch_collect.py --job-name "batches/XXXX" --status-only

# Collect results
python batch_collect.py --job-name "batches/XXXX"

# Submit next batch
python batch_submit.py --batch-num N

# List remaining batches
python batch_submit.py --list-batches
```
