# TODO: Collect Batch Results

## Pending Batches

### Batch 1 (submitted 2025-12-16 09:32)
- **Job ID:** `batches/7ytze7my8tvs1u1e6l54fgkhnwiqsx2u6ofe`
- **Model:** gemini-2.5-flash (batch API, 50% discount)
- **Requests:** 1619 steps
- **Syntheses:** 100 (IDs 3332-3468)
- **Estimated cost:** ~$14

### Check Status
```bash
cd /mnt/e/repos/djeca/pathways/pathways-in-practice/smiles-extractor
source venv/bin/activate
python batch_collect.py --job-name "batches/7ytze7my8tvs1u1e6l54fgkhnwiqsx2u6ofe" --status-only
```

### Collect Results (when SUCCEEDED)
```bash
python batch_collect.py --job-name "batches/7ytze7my8tvs1u1e6l54fgkhnwiqsx2u6ofe"
```

## Remaining Batches

| Batch | Syntheses | Est. Steps | Status |
|-------|-----------|------------|--------|
| 1 | 100 | 1619 | **SUBMITTED** |
| 2 | 100 | ~1578 | Pending |
| 3 | 100 | ~1838 | Pending |
| ... | ... | ... | ... |
| 37 | 23 | ~376 | Pending |

**Total remaining:** 36 batches, ~3523 syntheses, ~57,254 steps

## Submit Next Batch
```bash
python batch_submit.py --batch-num 2
```

## Full Scale Estimate
- **Total steps:** ~58,873
- **Est. cost:** ~$500 (batch pricing)
- **Processing time:** ~24h per batch typically
