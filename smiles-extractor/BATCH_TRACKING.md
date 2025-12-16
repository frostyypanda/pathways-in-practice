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

## Pending Batches

*None currently*

### Notes
- Test batch had overnight delay (manually collected next day)
- Batches 1-2 processed in ~55 min on average
- ~99.6% success rate (JSON parse errors from invalid escape sequences)

## Progress Summary

| Metric | Count |
|--------|-------|
| Syntheses processed | 305 |
| Total steps in DB | ~5,100 |
| Remaining syntheses | 3,323 |
| Estimated remaining steps | ~53,800 |
| Batches remaining | 9 (at 400/batch) |

## Cost Estimation

### Per-Step Estimate
- Input tokens per step: ~2,500 (prompt + image)
- Output tokens per step: ~500 (JSON response)
- Cost per step: ~$0.00034

### Completed Cost
- Steps processed: 3,535
- Estimated cost: ~$1.20

### Projected Total Cost
- Total steps: ~58,500
- Estimated total cost: ~$20
- Already spent: ~$1.20
- Remaining: ~$19

## Timeline Projection

At ~55 min per batch (100 syntheses):
- Batches remaining: 35
- Time per day (if continuous): ~17 batches
- Estimated completion: 2-3 days of batching

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
