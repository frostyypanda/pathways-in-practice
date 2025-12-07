# Strategy: Multi-Step Total Synthesis Extraction

## Goal
Extract 200+ multi-step total syntheses of natural products and approved pharmaceuticals, prioritizing longer syntheses (10+ steps), with chemically accurate SMILES for every intermediate.

## Key Challenge
ORD is fundamentally **single-step focused**:
- 20 million reactions, but `reaction_id` linkage field is almost never populated (0% in sampled data)
- No public REST API for "find reactions by product SMILES"
- Most ORD data is high-throughput screening, not total synthesis

## Solution: Hybrid "Pull" Approach
Instead of downloading all ORD data, we **start with known synthesis routes** and pull data as needed.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  CURATED TARGET LIST                                        │
│  (Famous syntheses: Taxol, Strychnine, Morphine, etc.)      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  ROUTE EXTRACTION                                           │
│  - Wikipedia / Review papers / TotSynth.com                 │
│  - Get: intermediate names, reaction types, step count      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  SMILES LOOKUP (PubChem API)                                │
│  - For each intermediate → get canonical SMILES             │
│  - Missing? → mark as "???"                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  ORD DATA ENRICHMENT (Optional)                             │
│  - Search ORD for matching transformations                  │
│  - If found → use real yields, conditions                   │
│  - If not → use literature data or "???"                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  EXPORT TO OPENSYNTH JSON                                   │
│  - public/data/{class}/{molecule_author_year}.json          │
│  - Update index.json                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Sources

| Source | What it Provides | Access |
|--------|------------------|--------|
| **Wikipedia** | Synthesis routes for famous molecules | Free |
| **Organic Syntheses** | Verified procedures with intermediates | Free |
| **TotSynth.com** | Curated total synthesis summaries | Free |
| **Review papers** | "Total synthesis of X" articles | DOI |
| **PubChem API** | SMILES for named compounds | Free REST API |
| **ORD** | Experimental data (yields, conditions) | Free (local search) |

---

## Implementation Phases

### Phase 1: Curated Target List
Create `scripts/data_ingestion/synthesis_targets/`:

1. **`targets.json`** - List of target molecules:
   ```json
   {
     "taxol": {
       "class": "Terpene",
       "routes": [
         {"author": "Nicolaou", "year": 1994, "steps": 51},
         {"author": "Holton", "year": 1994, "steps": 46}
       ]
     }
   }
   ```

2. **`route_sources.md`** - Links to synthesis route information

### Phase 2: Route Extraction Pipeline
3. **`route_extractor.py`** - Parse synthesis routes:
   - Input: Target name + source (Wikipedia URL, DOI, etc.)
   - Output: List of steps with intermediate names, reaction types
   - Handle variations (different authors' routes)

4. **`pubchem_client.py`** - Get SMILES from PubChem:
   - Search by compound name → get CID → get SMILES
   - Cache results to avoid repeated API calls
   - Rate limiting (5 requests/second)

### Phase 3: Data Enrichment (Optional)
5. **`ord_matcher.py`** - Search ORD for experimental data:
   - Given reactant + product SMILES, find matching ORD reactions
   - Extract: yield, temperature, solvent, time
   - Falls back to literature data if not found

### Phase 4: Export
6. **`schema_mapper.py`** - Convert to OpenSynth JSON format
7. **`pipeline.py`** - Main orchestration script

---

## Prioritization Logic

Target syntheses prioritized by:
1. **Step count**: 10+ steps first, then 5-9, then 2-4
2. **Historical significance**: Classic syntheses (Woodward, Corey, Nicolaou)
3. **Compound class**: Natural products > Pharmaceuticals > Others
4. **Data completeness**: Routes with more known intermediates

---

## Output Format

Files: `public/data/{class}/{molecule_author_year}.json`

```json
{
    "$schema": "../schema.json",
    "meta": {
        "id": "taxol-nicolaou-1994",
        "molecule_name": "Taxol",
        "class": "Terpene",
        "author": "Nicolaou, K.C.",
        "year": 1994,
        "doi": "10.1021/...",
        "source_url": "https://en.wikipedia.org/wiki/Taxol_total_synthesis"
    },
    "sequence": [
        {
            "step_id": 1,
            "reaction_type": "Aldol Addition",
            "reagents": "LDA, THF",
            "conditions": "-78°C, 2h",
            "yield": "85%",
            "reactant_smiles": "CC(=O)CC",
            "product_smiles": "CC(O)CC(=O)CC",
            "notes": "Formation of β-hydroxy ketone"
        },
        {
            "step_id": 2,
            "reaction_type": "???",
            "reagents": "???",
            "conditions": "???",
            "yield": "???",
            "reactant_smiles": "???",
            "product_smiles": "???",
            "notes": "Data not yet available - community contribution welcome"
        }
    ]
}
```

**Note**: Steps with "???" indicate missing data that can be filled in later.

---

## Files to Create

```
scripts/data_ingestion/synthesis_pipeline/
├── __init__.py
├── config.py              # Cache paths, API endpoints
├── pubchem_client.py      # PubChem API wrapper
├── route_extractor.py     # Parse synthesis routes from sources
├── schema_mapper.py       # Convert to OpenSynth JSON
├── pipeline.py            # Main entry point
└── targets/
    ├── alkaloids.json     # Target list: alkaloids
    ├── terpenes.json      # Target list: terpenes
    └── pharmaceuticals.json
```

---

## Files to Modify

- `public/data/index.json` - Add new synthesis entries
- `package.json` - Add npm script for running pipeline

---

## Dependencies

Python:
- `requests` (API calls to PubChem)
- `rdkit` (SMILES validation - optional)

---

## Handling Missing Data

| Situation | Solution |
|-----------|----------|
| Intermediate name not in PubChem | Mark SMILES as "???" |
| Yield not reported | Mark as "???" or "not reported" |
| Reaction type unclear | Use generic "Transformation" |
| Multiple routes exist | Create separate JSON files per route |
| Step details missing | Mark as "???" for community contribution |

---

## Workflow for Adding a New Synthesis

```
1. Find target molecule with known synthesis route
   └─→ Wikipedia, review paper, TotSynth.com

2. Extract route information
   └─→ Step count, intermediate names, reaction types

3. Look up SMILES for each intermediate
   └─→ PubChem API by name
   └─→ Manual lookup if not found
   └─→ "???" if truly unavailable

4. Create JSON file
   └─→ Fill in all available data
   └─→ Mark unknowns as "???"

5. Update index.json
   └─→ Add entry with step_count

6. (Optional) Search ORD for experimental data
   └─→ Enrich with real yields/conditions
```

---

## Example Execution

```bash
# Run pipeline for a single target
python scripts/data_ingestion/synthesis_pipeline/pipeline.py \
    --target "strychnine" \
    --author "Woodward" \
    --year 1954

# Run for all targets in a category
python scripts/data_ingestion/synthesis_pipeline/pipeline.py \
    --category alkaloids
```
