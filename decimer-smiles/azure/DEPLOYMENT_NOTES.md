# DECIMER Azure Deployment - Complete Documentation

## Project Overview

**Goal:** Process ~209,736 chemical structure images across 4,099 synthesis directories using [DECIMER](https://github.com/Kohulan/DECIMER-Image_to_SMILES) (Deep lEarning for Chemical ImagE Recognition) to extract SMILES strings.

**Timeline:** December 2024

**Final Configuration:** 8x D16ds_v5 VMs processing in parallel, ~4 hours total runtime, ~$27 cost.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Key Learnings](#key-learnings)
3. [Deployment Process](#deployment-process)
4. [Scripts Reference](#scripts-reference)
5. [Monitoring & Debugging](#monitoring--debugging)
6. [Lessons Learned](#lessons-learned)
7. [Cost Analysis](#cost-analysis)

---

## Architecture

### System Components

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Azure Blob    │     │     PostgreSQL       │     │    Azure VMs (8x)   │
│    Storage      │◄────┤    (Coordination)    │◄────┤    D16ds_v5         │
│  (Images/Data)  │     │                      │     │                     │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
        │                        │                            │
        │                        │                            │
   decimerstorage50576    www-site-db-server        blob_processor.py
   chemistry-data/        pathwayspractice             ├── worker.py
    ├── {synthesis}/                                   └── db_config.py
    │   └── output/*.png
    └── results/
```

### Database Schema

```sql
-- Work queue with atomic locking
CREATE TABLE synthesis (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, locked, completed, failed
    locked_by TEXT,
    locked_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    worker_id TEXT,
    successful INTEGER,
    failed INTEGER,
    image_count INTEGER
);

-- Individual SMILES results
CREATE TABLE smiles_results (
    id SERIAL PRIMARY KEY,
    synthesis_id INTEGER REFERENCES synthesis(id),
    image_filename TEXT NOT NULL,
    smiles TEXT,
    smiles_confidence FLOAT,
    error TEXT,
    duration_ms INTEGER,
    worker_id TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(synthesis_id, image_filename)
);

-- Centralized logging (replaces file logging)
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    worker_id TEXT,
    directory TEXT,
    level TEXT,      -- 'INFO' or 'ERROR'
    message TEXT,
    traceback TEXT
);
```

### Locking Mechanism

Atomic locking using PostgreSQL `FOR UPDATE SKIP LOCKED`:

```sql
-- Atomically find and lock next available directory
UPDATE synthesis
SET status = 'locked', locked_by = %s, locked_at = NOW()
WHERE name = (
    SELECT name FROM synthesis
    WHERE status = 'pending'
       OR (status = 'locked' AND locked_at < NOW() - INTERVAL '5 minutes')
    ORDER BY name LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING name
```

**Key features:**
- Directories auto-unlock after 5 minutes (handles VM crashes/evictions)
- Workers extend lock after processing each image
- `SKIP LOCKED` prevents contention between VMs

---

## Key Learnings

### Resource Usage Per DECIMER Worker

Through extensive testing, we determined:

| Metric | Value |
|--------|-------|
| **Memory per worker** | ~4.7 GB |
| **CPU per worker** | ~1.3 cores (CPU-bound) |
| **Processing time** | ~2.7 seconds per image |
| **Model load time** | ~10-15 seconds (first image) |

### Self-Throttling Strategy

**The Problem:** Fixed worker counts either under-utilize or over-utilize the VM.

**The Solution:** Dynamic worker management based on CPU/memory thresholds.

```python
# Configuration
CPU_THRESHOLD = 60      # Only spawn when CPU < 60%
MEMORY_THRESHOLD = 60   # Only spawn when memory < 60%
MAX_WORKERS = max(1, int(cpu_count * 0.8 / 2))  # Hard cap

# 5-second averaged readings prevent spawning on spikes
def get_resources():
    cpu_samples, mem_samples = [], []
    for _ in range(5):
        cpu_samples.append(psutil.cpu_percent(interval=1))
        mem_samples.append(psutil.virtual_memory().percent)
    return sum(cpu_samples) / 5, sum(mem_samples) / 5
```

**Observed behavior on D16ds_v5 (16 cores, 64 GB):**
- MAX_WORKERS = 6 (theoretical cap)
- Actual workers: 4-5 (self-limited by 60% CPU threshold)
- CPU utilization: 64-79% (stays under 80%)
- Memory: 40-42%

### DECIMER Model Pre-loading (Critical!)

**The Bug:** Multiple workers importing DECIMER simultaneously corrupt model downloads (~500MB zip files).

**The Fix:** Pre-load models in `blob_processor.py` BEFORE spawning any workers.

```python
def preload_decimer_models():
    """Pre-load DECIMER models to avoid race conditions."""
    from DECIMER import predict_SMILES  # Downloads/loads models
    log_to_db('INFO', "DECIMER models loaded successfully")

def main():
    preload_decimer_models()  # MUST be first!
    # ... then spawn workers
```

### VM Size Selection

**Bottleneck:** CPU (not memory, not I/O)

| VM Type | Cores | RAM | Workers | CPU Usage | Notes |
|---------|-------|-----|---------|-----------|-------|
| Standard_E4s_v3 | 4 | 32GB | 3 | 99% | Memory wasted |
| Standard_D8s_v5 | 8 | 32GB | 5-6 | 75% | Good balance |
| **Standard_D16ds_v5** | 16 | 64GB | 4-5 | 64-79% | **Best value** |
| Standard_F16s_v2 | 16 | 32GB | 6 | 80% | Memory-limited |

**Recommendation:** D-series (general-purpose) with 64GB+ RAM for flexibility.

---

## Deployment Process

### Prerequisites

1. Azure subscription with sufficient quota
2. SSH key pair generated
3. Azure CLI installed (`az login` completed)

### Step 1: Create VM

```bash
# Check D16ds_v5 availability in regions
az vm list-sizes --location westus2 --output table | grep D16ds

# Create VM
az vm create \
    --resource-group decimer-rg \
    --name decimer-vm-d16 \
    --image Ubuntu2204 \
    --size Standard_D16ds_v5 \
    --admin-username azureuser \
    --generate-ssh-keys
```

### Step 2: Setup VM Environment

```bash
# SSH into VM
ssh azureuser@<VM_IP>

# Install Python 3.10 and dependencies
sudo apt update
sudo apt install -y python3.10 python3.10-venv python3-pip

# Create project directory
sudo mkdir -p /opt/decimer
sudo chown azureuser:azureuser /opt/decimer
cd /opt/decimer

# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate

# Exit for now
exit
```

### Step 3: Deploy Scripts (Use SCP!)

**From your local machine:**

```bash
cd /mnt/c/Users/almir/azure  # or wherever scripts are

# Copy all required files
scp blob_processor.py worker.py db_config.py requirements.txt azureuser@<VM_IP>:/opt/decimer/

# Install dependencies
ssh azureuser@<VM_IP> "cd /opt/decimer && source venv/bin/activate && pip install -r requirements.txt"
```

### Step 4: Start Processing

```bash
# Start processor (runs in background)
ssh azureuser@<VM_IP> "cd /opt/decimer && source venv/bin/activate && nohup python -u blob_processor.py > /dev/null 2>&1 &"
```

### Step 5: Scale to More VMs

Repeat steps 1-4 for additional VMs. The PostgreSQL locking ensures no conflicts.

**Our 8-VM deployment:**

| VM Name | IP | Region |
|---------|---|----|
| decimer-vm-d16 | 4.155.214.89 | westus2 |
| decimer-vm-d16-2 | 40.125.72.105 | westus2 |
| decimer-vm-d16-3 | 20.3.200.238 | westus2 |
| decimer-vm-d16-4 | 4.246.100.88 | westus2 |
| decimer-vm-d16-5 | 20.168.73.152 | westus3 |
| decimer-vm-d16-6 | 20.168.23.59 | westus3 |
| decimer-vm-d16-7 | 20.172.31.7 | westus3 |
| decimer-vm-d16-8 | 57.154.17.156 | westus3 |

**Note:** We hit quota limit in westus2 (64/65 cores) after 4 VMs, so VMs 5-8 are in westus3.

---

## Scripts Reference

### requirements.txt

```
decimer
psutil
psycopg2-binary
azure-storage-blob
```

### db_config.py

Configuration file with database and blob storage credentials.

```python
DB_CONFIG = {
    'host': 'www-site-db-server.postgres.database.azure.com',
    'database': 'pathwayspractice',
    'user': 'decimer_user',
    'password': '***',
    'sslmode': 'require'
}

BLOB_CONNECTION_STRING = '***'
BLOB_CONTAINER = 'chemistry-data'
```

### blob_processor.py

Main orchestrator that:
1. Pre-loads DECIMER models (critical for avoiding race conditions)
2. Monitors CPU/memory usage
3. Spawns worker processes when resources available
4. Atomically locks directories via PostgreSQL
5. Logs all activity to database

**Key functions:**
- `preload_decimer_models()` - Load models before workers start
- `find_and_lock_available()` - Atomic directory locking
- `can_spawn()` - Check if resources allow new worker
- `get_resources()` - 5-second averaged CPU/memory

### worker.py

Individual worker process that:
1. Downloads images from blob storage to temp directory
2. Processes each image with DECIMER
3. Saves SMILES results to database
4. Extends lock after each image
5. Marks directory completed/failed

**Key functions:**
- `extend_lock()` - Keep directory locked while processing
- `save_smiles_result()` - Store SMILES with confidence
- `mark_completed()` / `mark_failed()` - Update synthesis status

---

## Monitoring & Debugging

### Check Progress

```sql
-- Overall status
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'locked') as locked,
    COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM synthesis;

-- Recent activity
SELECT * FROM logs WHERE level = 'INFO' ORDER BY id DESC LIMIT 20;

-- Errors
SELECT * FROM logs WHERE level = 'ERROR' ORDER BY id DESC LIMIT 10;

-- Which VMs are working
SELECT DISTINCT worker_id, COUNT(*)
FROM logs
WHERE timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY worker_id;
```

### Check VM Status

```bash
# SSH and check processes
ssh azureuser@<VM_IP> "ps aux | grep python"

# Check resource usage
ssh azureuser@<VM_IP> "htop"  # or "top"

# View processor logs
ssh azureuser@<VM_IP> "tail -f /opt/decimer/nohup.out"  # if not redirected
```

### Reset Failed Directories

```sql
UPDATE synthesis
SET status = 'pending', locked_by = NULL, locked_at = NULL
WHERE status = 'failed';
```

### Download Results

```bash
# Using Azure CLI
az storage blob download-batch \
    --source chemistry-data \
    --destination ./results \
    --pattern "results/*" \
    --connection-string "$AZURE_STORAGE_CONNECTION_STRING"

# Export SMILES from database
psql -h www-site-db-server.postgres.database.azure.com \
     -U decimer_user -d pathwayspractice \
     -c "COPY (SELECT s.name, r.image_filename, r.smiles, r.smiles_confidence
         FROM smiles_results r JOIN synthesis s ON r.synthesis_id = s.id)
         TO STDOUT WITH CSV HEADER" > smiles_export.csv
```

---

## Lessons Learned

### What Worked

1. **PostgreSQL for coordination** - Atomic locking with `FOR UPDATE SKIP LOCKED` is perfect for distributed work queues.

2. **Self-throttling workers** - 60% CPU/memory threshold with 5-second averaging prevents over-subscription while maximizing utilization.

3. **SCP for deployment** - Simple, reliable, works with SSH keys already configured.

4. **Centralized logging** - Database logging is queryable, aggregatable, and survives VM termination.

5. **Lock extension after each image** - Prevents work loss if a directory has many images.

### What Didn't Work

1. **`az run-command`** - Mangles special characters in Python code. Unusable for script deployment.

2. **Blob storage download for scripts** - Overcomplicated. Requires azure-storage-blob installed first (chicken-and-egg problem).

3. **Fixed worker counts** - Either under-utilizes resources or causes OOM/CPU contention.

4. **Parallel DECIMER model loading** - Race condition corrupts the ~500MB model download. Must pre-load in main process.

5. **File-based logging** - Logs lost on VM termination. Database logging is far superior.

### Deployment Method Evolution

| Attempt | Method | Result |
|---------|--------|--------|
| 1 | `az run-command` with inline Python | Failed - special characters mangled |
| 2 | `az run-command` with base64 | Failed - same issues |
| 3 | Upload to blob, download on VM | Worked but complex |
| 4 | **SCP + requirements.txt** | **Best solution** |

**Final workflow:**
```bash
scp *.py requirements.txt azureuser@<VM_IP>:/opt/decimer/
ssh azureuser@<VM_IP> "cd /opt/decimer && source venv/bin/activate && pip install -r requirements.txt"
```

---

## Cost Analysis

### Final Configuration

- **8x Standard_D16ds_v5** (16 cores, 64 GB RAM each)
- **Pay-as-you-go pricing:** ~$0.768/hour per VM
- **Runtime:** ~4 hours

### Cost Breakdown

| Item | Cost |
|------|------|
| 8 VMs × $0.77/hr × 4 hours | ~$24.64 |
| Storage (11 GB, negligible) | ~$0.05 |
| Egress (results download) | ~$0.50 |
| PostgreSQL (existing) | $0 |
| **Total** | **~$25-27** |

### Alternative: Spot Instances

We tried spot instances but availability was limited. If available:

| Region | Spot Price | Savings |
|--------|-----------|---------|
| uksouth | $0.14/hr | 82% |
| westus3 | $0.17/hr | 78% |

Spot pricing would reduce costs to ~$5-7 total.

**Note:** Spot VMs can be evicted with 30 seconds notice. Our locking mechanism handles this gracefully - locked directories expire after 5 minutes and get reassigned.

---

## Performance Summary

| Metric | Value |
|--------|-------|
| **Total images** | 209,736 |
| **Total directories** | 4,099 |
| **Active VMs** | 8 |
| **Workers per VM** | 4-5 |
| **Total workers** | ~35-40 |
| **Processing rate** | ~15 images/second |
| **Total runtime** | ~4 hours |
| **Cost** | ~$27 |
| **Cost per image** | ~$0.00013 |

---

## Cleanup

After processing completes:

```bash
# Delete all VMs
for i in 1 2 3 4 5 6 7 8; do
    az vm delete --resource-group decimer-rg --name decimer-vm-d16-$i --yes --no-wait
done

# Or delete entire resource group
az group delete --name decimer-rg --yes
```
