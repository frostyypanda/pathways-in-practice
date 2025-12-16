# Database Schema

PostgreSQL database hosted on Azure for the OpenSynth chemistry synthesis data pipeline.

## Connection Details

- **Host:** `www-site-db-server.postgres.database.azure.com`
- **Database:** `pathwayspractice`
- **User:** `decimer_user`
- **SSL:** Required

Environment variables (in `smiles-extractor/.env`):
```
DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_SSLMODE
```

---

## Tables

### `synthesis`

Master table containing synthesis metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR | Format: "Molecule Name (Author Year)" |
| `status` | VARCHAR | Processing status: 'completed', 'failed', etc. |

**Example:**
```sql
SELECT id, name, status FROM synthesis WHERE id = 3829;
-- Result: 3829, "Bilain B (Strand 2024)", "completed"
```

---

### `smiles_results`

Initial SMILES extraction results from DECIMER (before LLM validation).

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `synthesis_id` | INTEGER | FK to `synthesis.id` |
| `image_filename` | VARCHAR(100) | Split image filename |
| `smiles` | TEXT | Raw SMILES from DECIMER extraction |
| `smiles_confidence` | FLOAT | Confidence score (0-1) |

**Image filename convention:**
- `sequence_01_left.png` - Reactant
- `sequence_01_middle.png` - Reagent/conditions
- `sequence_01_right.png` - Product

Each synthesis step generates 3 rows (one per image part).

---

### `synthesis_steps`

LLM-validated synthesis step data (primary output table).

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `synthesis_id` | INTEGER | FK to `synthesis.id` |
| `image_filename` | VARCHAR(100) | Step image: "sequence_01.png" |
| **Original SMILES** | | |
| `original_reactant_smiles` | TEXT | From `smiles_results` (before LLM) |
| `original_reagent_smiles` | TEXT | From `smiles_results` (before LLM) |
| `original_product_smiles` | TEXT | From `smiles_results` (before LLM) |
| **Corrected SMILES** | | |
| `corrected_reactant_smiles` | TEXT | LLM-validated reactant |
| `corrected_reagent_smiles` | TEXT | LLM-validated reagent |
| `corrected_product_smiles` | TEXT | LLM-validated product |
| **Extracted Text** | | |
| `reagents` | TEXT | Chemical reagents (e.g., "TBDPSCl, imidazole") |
| `conditions` | TEXT | Reaction conditions (temp, time, solvent) |
| `yield` | VARCHAR(20) | Reaction yield (e.g., "95%") |
| `reaction_type` | VARCHAR(100) | Classification (e.g., "Grignard Reaction") |
| `notes` | TEXT | Additional transformation notes |
| **Quality Metrics** | | |
| `corrections_made` | JSONB | Array of corrections applied by LLM |
| `continuity` | JSONB | `{matches_previous: bool, matches_next: bool}` |
| **Processing Metadata** | | |
| `llm_model` | VARCHAR(100) | Model used (e.g., "gemini-2.5-flash") |
| `llm_cost` | DECIMAL(10,6) | Cost in USD |
| `tokens_used` | INTEGER | Total tokens consumed |
| `processed_at` | TIMESTAMP | Processing timestamp |

**Constraints:**
- `UNIQUE (synthesis_id, image_filename)` - One record per step per synthesis

**Insert pattern:**
```sql
INSERT INTO synthesis_steps (...) VALUES (...)
ON CONFLICT (synthesis_id, image_filename) DO UPDATE SET ...
```

---

### `logs`

Application logging table for tracking processing events.

| Column | Type | Description |
|--------|------|-------------|
| (Schema TBD) | | |

---

## Relationships

```
                     synthesis
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
   smiles_results   synthesis_steps    logs
   (3 per step)      (1 per step)
```

**Data flow:**
1. Images split into left/middle/right parts
2. DECIMER extracts initial SMILES → `smiles_results`
3. LLM validates and corrects → `synthesis_steps`
4. Export to JSON for web app

---

## Common Queries

**Get syntheses ready for processing:**
```sql
SELECT s.id, s.name
FROM synthesis s
WHERE s.status = 'completed'
  AND s.id NOT IN (SELECT DISTINCT synthesis_id FROM synthesis_steps)
  AND s.id IN (SELECT DISTINCT synthesis_id FROM smiles_results);
```

**Get step count for a synthesis:**
```sql
SELECT COUNT(DISTINCT regexp_replace(image_filename, '_(left|middle|right)\.png$', ''))
FROM smiles_results
WHERE synthesis_id = ?;
```

**Export synthesis steps:**
```sql
SELECT image_filename,
       corrected_reactant_smiles, corrected_reagent_smiles, corrected_product_smiles,
       reagents, conditions, yield, reaction_type, notes
FROM synthesis_steps
WHERE synthesis_id = ?
ORDER BY image_filename;
```

**Get all corrected SMILES for validation:**
```sql
SELECT id, synthesis_id, image_filename,
       corrected_reactant_smiles,
       corrected_reagent_smiles,
       corrected_product_smiles
FROM synthesis_steps
ORDER BY id;
```

---

## Statistics

As of December 2024:
- Syntheses processed: ~305
- Total steps in DB: ~5,100
- Remaining syntheses: ~3,323
- Estimated remaining steps: ~53,800
