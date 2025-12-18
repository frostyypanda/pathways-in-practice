# DECIMER Azure Processing Pipeline

## Overview
Process 216,057 chemical structure images across 4,099 synthesis directories using DECIMER on Azure VMs.

## Architecture
```
PostgreSQL (coordination)     Azure Blob Storage (data)
        |                              |
        v                              v
   synthesis table              chemistry-data container
   - locking                    - images (input)
   - status tracking            - results (output)
   - stats
        |                              |
        +--------> Azure VMs <---------+
                   (workers)
```

## Setup

### 1. Create `.env` file
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 2. Install dependencies
```bash
pip install psycopg2-binary azure-storage-blob
```

## Credentials

Credentials are loaded from `.env` file (not committed to git). See `.env.example` for required variables:
- `DB_HOST` - PostgreSQL server hostname
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `BLOB_CONNECTION_STRING` - Azure Blob Storage connection string
- `BLOB_CONTAINER` - Blob container name

**IMPORTANT: URL Encoding for psql CLI**

When connecting via `psql` command line, special characters in the password MUST be URL-encoded:
- `!` → `%21`
- `@` → `%40`
- `#` → `%23`

```bash
# Example (replace with your actual credentials):
PGSSLMODE=require psql "postgresql://$DB_USER:$DB_PASSWORD_ENCODED@$DB_HOST/$DB_NAME"
```

Python's psycopg2 handles this automatically with the `DB_CONFIG` dict.

## Database Schema

```sql
CREATE TABLE synthesis (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, locked, completed, failed
    image_count INT,
    locked_by TEXT,
    locked_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    worker_id TEXT,
    successful INT,
    failed INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Key SQL Operations

### Acquire lock (atomic)
```sql
UPDATE synthesis
SET status = 'locked', locked_by = 'vm-0-worker-1', locked_at = NOW()
WHERE name = (
    SELECT name FROM synthesis
    WHERE status = 'pending'
       OR (status = 'locked' AND locked_at < NOW() - INTERVAL '5 minutes')
    ORDER BY name
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING name;
```

### Mark completed
```sql
UPDATE synthesis
SET status = 'completed', completed_at = NOW(), successful = X, failed = Y
WHERE name = 'dirname';
```

### Get stats
```sql
SELECT status, COUNT(*) FROM synthesis GROUP BY status;
```

## Files

| File | Purpose |
|------|---------|
| `.env.example` | Template for environment variables |
| `.env` | Actual credentials (not committed) |
| `db_config.py` | Loads credentials from environment |
| `worker.py` | Processes single directory |
| `blob_processor.py` | Spawns workers, monitors resources |
| `setup_vm.sh` | VM initialization script |
| `failed_syntheses.txt` | List of failed synthesis names |

## Processing Flow

1. `blob_processor.py` checks CPU/memory
2. If < 75%, spawns `worker.py` subprocess
3. Worker acquires lock via PostgreSQL (atomic UPDATE)
4. Worker downloads images from blob
5. Worker runs DECIMER on each image
6. Worker uploads results to blob
7. Worker marks synthesis as completed in PostgreSQL
8. Repeat until all done

## Estimated Runtime
- ~2.7 seconds per image
- ~54 images per directory average
- 4 VMs × 4 workers = 16 parallel workers
- ~6-8 hours total

## Processing Status (as of Dec 2024)

| Status | Count |
|--------|-------|
| Completed | 3636 |
| Failed | 463 |
| **Total** | **4099** |

### Query Failed Syntheses
```bash
# Get status counts (set your env vars first)
PGSSLMODE=require psql "postgresql://$DB_USER:$DB_PASSWORD_ENCODED@$DB_HOST/$DB_NAME" \
  -c "SELECT count(*), status FROM synthesis GROUP BY status;"

# Export failed synthesis names to file
PGSSLMODE=require psql "postgresql://$DB_USER:$DB_PASSWORD_ENCODED@$DB_HOST/$DB_NAME" \
  -c "SELECT name FROM synthesis WHERE status = 'failed' ORDER BY name;" -t -A > failed_syntheses.txt
```

## Local Reprocessing

The 463 failed syntheses can be reprocessed locally.

### Path Mappings

| Context | Path |
|---------|------|
| Windows | `D:\chemistry-scraped\` |
| WSL | `/mnt/d/chemistry-scraped/` |
| Repo (Windows) | `E:\repos\djeca\pathways\pathways-in-practice\decimer-smiles\` |
| Repo (WSL) | `/mnt/e/repos/djeca/pathways/pathways-in-practice/decimer-smiles/` |

Each synthesis directory structure:
```
D:\chemistry-scraped\Synthesis Name (Author Year)\
└── output\
    ├── sequence_01_left.png    # Reactant structure
    ├── sequence_01_middle.png  # Reagents/arrow (often skipped)
    ├── sequence_01_right.png   # Product structure
    └── ...
```

### Encoding Issues

**PostgreSQL Connection (psql CLI)**
- Special chars in password need URL encoding: `!` → `%21`
- Use environment variables for credentials

**File Paths (WSL)**
- Windows paths like `D:\chemistry-scraped` become `/mnt/d/chemistry-scraped` in WSL
- Synthesis names contain spaces and parentheses - always quote paths:
  ```bash
  # CORRECT:
  python process_synthesis.py "/mnt/d/chemistry-scraped/10-Demethoxy Vincorine (Garg 2018)/"

  # WRONG (will fail):
  python process_synthesis.py /mnt/d/chemistry-scraped/10-Demethoxy Vincorine (Garg 2018)/
  ```

### Reprocess Failed Locally
```bash
cd /mnt/e/repos/djeca/pathways/pathways-in-practice/decimer-smiles
source venv/bin/activate

# Process single failed synthesis
python process_synthesis.py "/mnt/d/chemistry-scraped/Synthesis Name (Author Year)/"

# Batch process all failed (saves to database)
python process_failed_local.py --threads 2
python process_failed_local.py --dry-run  # Check what needs processing
```
