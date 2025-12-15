# TODO: Collect Batch Results (2025-12-16)

## Batch Job Info

- **Job ID:** `batches/r5zzlswvdq044sd07sx3josyu8ixy8kndmm9`
- **Submitted:** 2025-12-15 21:49
- **Requests:** 88 steps
- **Syntheses:** 3829, 3842, 3867, 3869

## Step 1: Check Status

```bash
cd /mnt/e/repos/djeca/pathways/pathways-in-practice/smiles-extractor
source venv/bin/activate
python batch_collect.py --job-name "batches/r5zzlswvdq044sd07sx3josyu8ixy8kndmm9" --status-only
```

Expected states:
- `JOB_STATE_PENDING` - Still queued
- `JOB_STATE_RUNNING` - Processing
- `JOB_STATE_SUCCEEDED` - Ready to collect
- `JOB_STATE_FAILED` - Something went wrong

## Step 2: Collect Results (when SUCCEEDED)

```bash
python batch_collect.py --job-name "batches/r5zzlswvdq044sd07sx3josyu8ixy8kndmm9"
```

This will:
1. Download results from Gemini
2. Parse each response
3. INSERT into `synthesis_steps` table

## Step 3: Verify Results

```sql
-- Count steps by synthesis
SELECT s.name, COUNT(*) as steps
FROM synthesis_steps ss
JOIN synthesis s ON ss.synthesis_id = s.id
GROUP BY s.name
ORDER BY s.name;

-- Expected:
-- Bilain B (Strand 2024)      | 15
-- Biperiden (Akineton Abbott) | 4  (already done via sync)
-- Biopyrrin A (Svenda 2024)   | 22
-- Bipolarolide A (Lu 2025)    | 27
-- Bipolarolide B (Lu 2025)    | 24
-- Total: 92 steps
```

## Step 4: Calculate Cost

```sql
-- Sync test cost (already in DB)
SELECT SUM(llm_cost) as sync_cost, SUM(tokens_used) as sync_tokens
FROM synthesis_steps
WHERE llm_model = 'gemini-2.5-flash';

-- Batch cost (estimate from token count)
-- Batch API = 50% of standard pricing
-- Input: $0.05/1M tokens, Output: $0.10/1M tokens (thinking) + $0.20/1M (response)
```

**Cost comparison:**
- Sync test (4 steps): $0.07 (~$0.017/step)
- Batch (88 steps): ~$0.75 estimated (50% discount = ~$0.0085/step)

## Step 5: Spot Check Quality

```sql
-- Sample some results
SELECT image_filename,
       LEFT(original_product_smiles, 40) as original,
       LEFT(corrected_product_smiles, 40) as corrected,
       reagents, reaction_type
FROM synthesis_steps
WHERE synthesis_id = 3829
ORDER BY image_filename
LIMIT 5;
```

Then visually verify 2-3 steps against the actual images at:
`/mnt/d/chemistry-scraped/{synthesis_name}/{image_filename}`

## Files Reference

| File | Purpose |
|------|---------|
| `batch_jobs.json` | Tracks submitted batch jobs |
| `batch_requests.jsonl` | The 88 requests sent to Gemini (8.2 MB) |
| `batch_collect.py` | Script to collect results |
| `extract_and_store.py` | Sync processing (for comparison) |

## Next Steps After Verification

If quality is good:
1. Decide on full-scale approach (batch vs sequential)
2. For batch: submit all ~60K steps
3. Estimated full-scale cost: ~$500 (batch) or ~$1000 (sequential)
