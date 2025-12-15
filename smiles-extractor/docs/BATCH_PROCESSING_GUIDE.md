# SMILES Batch Processing Guide

**Created:** 2025-12-15

---

## Database Schema

### Table: `synthesis_steps`

One row per step - clean structure for all extraction results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `synthesis_id` | INTEGER | FK to synthesis table |
| `image_filename` | VARCHAR(100) | e.g., "sequence_01.png" |
| **Original SMILES** |
| `original_reactant_smiles` | TEXT | From smiles_results `_left.png` |
| `original_reagent_smiles` | TEXT | From smiles_results `_middle.png` |
| `original_product_smiles` | TEXT | From smiles_results `_right.png` |
| **Corrected SMILES** |
| `corrected_reactant_smiles` | TEXT | LLM-corrected |
| `corrected_reagent_smiles` | TEXT | LLM-corrected (if drawn structure) |
| `corrected_product_smiles` | TEXT | LLM-corrected |
| **Extracted Text** |
| `reagents` | TEXT | Text labels (e.g., "TBDPSCl, imidazole") |
| `conditions` | TEXT | Solvent, temp, time |
| `yield` | VARCHAR(20) | e.g., "95%" |
| `reaction_type` | VARCHAR(100) | e.g., "Grignard Reaction" |
| `notes` | TEXT | Description of transformation |
| **Quality** |
| `corrections_made` | JSONB | List of changes made |
| `continuity` | JSONB | {matches_previous, matches_next} |
| **Metadata** |
| `llm_model` | VARCHAR(100) | e.g., "gemini-2.5-flash" |
| `llm_cost` | DECIMAL(10,6) | Cost in USD |
| `tokens_used` | INTEGER | Total tokens |
| `processed_at` | TIMESTAMP | When processed |

**Unique constraint:** `(synthesis_id, image_filename)`

---

## Phase 1: Tonight - Process First ~100 Steps

### Run Test Batch

```bash
cd /mnt/e/repos/djeca/pathways/pathways-in-practice/smiles-extractor
source venv/bin/activate

python extract_and_store.py --synthesis-id 3856  # Biperiden (4 steps) - DONE
python extract_and_store.py --synthesis-id 3829  # Bilain B (15 steps)
python extract_and_store.py --synthesis-id 3842  # Biopyrrin A (22 steps)
python extract_and_store.py --synthesis-id 3867  # Bipolarolide A (27 steps)
python extract_and_store.py --synthesis-id 3869  # Bipolarolide B (24 steps)
```

**Estimated:** ~30 min, ~$1.50

---

## Phase 2: Tomorrow - Review & Verify

### 1. Query Results Summary

```sql
-- Count processed steps by synthesis
SELECT s.name, COUNT(*) as steps,
       SUM(llm_cost) as total_cost,
       SUM(tokens_used) as total_tokens
FROM synthesis_steps ss
JOIN synthesis s ON ss.synthesis_id = s.id
GROUP BY s.name
ORDER BY s.name;
```

### 2. Spot Check Quality

```sql
-- Compare original vs corrected
SELECT image_filename,
       LEFT(original_product_smiles, 40) as original,
       LEFT(corrected_product_smiles, 40) as corrected,
       reagents, conditions, yield, reaction_type
FROM synthesis_steps
WHERE synthesis_id = 3856
ORDER BY image_filename;
```

### 3. Review Corrections

```sql
-- See what changes were made
SELECT image_filename, corrections_made
FROM synthesis_steps
WHERE synthesis_id = 3856;
```

### 4. Visual Verification

For 5-10 random steps:
1. Open image at `/mnt/d/chemistry-scraped/{synthesis_name}/{image_filename}`
2. Check corrected SMILES matches screenshot
3. Verify reagents/conditions match text labels

---

## Phase 3: After Verification

### If Quality is Good (>95% accurate)

Proceed to full-scale processing.

### If Issues Found

1. **Prompt adjustments:** Update `docs/SINGLE_STEP_SMILES_VALIDATION_PROMPT.md`
2. **Re-run:** Delete rows and reprocess
3. **Model change:** Try `gemini-2.5-pro` for complex structures

### Clear Test Data (if needed)

```sql
DELETE FROM synthesis_steps
WHERE synthesis_id IN (3829, 3842, 3856, 3867, 3869);
```

---

## Phase 4: Full Scale - Process All ~60,000 Steps

### Option A: Sequential Processing (Simple)

```bash
# Get all synthesis IDs and process one by one
python process_all.py
```

- **Time:** 100+ hours (at ~6 sec/step)
- **Cost:** ~$1000+ (at ~$0.017/step based on test)

### Option B: Batch API (50% Discount) - RECOMMENDED

1. **batch_submit.py** - Build JSONL, submit to Gemini Batch API
2. **Wait** - Usually 1-6 hours
3. **batch_collect.py** - Download results, INSERT into synthesis_steps

- **Time:** 6-24 hours (async)
- **Cost:** ~$500+ (50% batch discount)

### Option C: Parallel Processing

Run multiple instances with different synthesis_id ranges.

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `extract.py` | Single step (testing/debugging) |
| `extract_and_store.py` | Process synthesis → INSERT to synthesis_steps |
| `batch_submit.py` | (TODO) Submit to Gemini Batch API |
| `batch_collect.py` | (TODO) Collect batch results |

---

## Cost Tracking

### Test Batch Results

| Synthesis | Steps | Cost | Tokens |
|-----------|-------|------|--------|
| Biperiden | 4 | $0.07 | 33,300 |
| Bilain B | 15 | TBD | |
| Biopyrrin A | 22 | TBD | |
| Bipolarolide A | 27 | TBD | |
| Bipolarolide B | 24 | TBD | |

**Avg cost per step:** ~$0.017

### Full Scale Projection (60,000 steps)

| Approach | Cost | Time |
|----------|------|------|
| Sequential | ~$1,000 | 100+ hours |
| Batch API | ~$500 | 6-24 hours |

---

## Checklist

### Tonight (Done)
- [x] Create synthesis_steps table
- [x] Test on Biperiden (4 steps) - $0.07
- [x] Submit batch job for 88 steps

### Tomorrow

**1. Check batch status:**
```bash
cd /mnt/e/repos/djeca/pathways/pathways-in-practice/smiles-extractor
source venv/bin/activate
python batch_collect.py --job-name "batches/r5zzlswvdq044sd07sx3josyu8ixy8kndmm9" --status-only
```

**2. When status is JOB_STATE_SUCCEEDED, collect results:**
```bash
python batch_collect.py --job-name "batches/r5zzlswvdq044sd07sx3josyu8ixy8kndmm9"
```

**3. Review results:**
```sql
SELECT s.name, COUNT(*) as steps
FROM synthesis_steps ss
JOIN synthesis s ON ss.synthesis_id = s.id
GROUP BY s.name;
```

### Full Scale
- [ ] Decide: sequential vs batch
- [ ] Process all syntheses
- [ ] Final quality review
