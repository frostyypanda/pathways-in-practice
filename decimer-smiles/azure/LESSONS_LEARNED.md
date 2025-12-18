# Lessons Learned - Cloud Deployment

## Issues Observed

### 1. OOM Kills (Exit code -9)
- Workers were killed when memory exceeded available RAM
- Each DECIMER worker uses ~5GB RAM when fully loaded
- **Fix**: Dynamic scaling - only spawn when CPU AND memory < 75%

### 2. Hardcoded Worker Limits
- We mistakenly added `len(processes) < 6` limits
- **Fix**: Remove ALL hardcoded limits. Let resource monitoring control spawning.

### 3. TensorFlow Multiprocessing Issues
- ProcessPoolExecutor caused all workers to crash simultaneously
- **Fix**: Use subprocess.Popen for complete process isolation

### 4. Azure SDK Verbose Logging
- Drowns out application logs
- **Fix**: `logging.getLogger('azure').setLevel(logging.WARNING)`

### 5. Directory Listing Too Slow
- `list_blobs()` iterated through all 200k+ blobs
- **Fix**: Use `walk_blobs(delimiter='/')` for directory-level listing

## Changes Needed for worker.py

### 1. Better Error Handling
- Catch and log specific exceptions
- Don't let one bad image crash the whole directory

### 2. Progress Reporting
- Log progress more frequently for long directories
- Consider uploading partial results periodically

### 3. Memory Monitoring
- Worker should monitor its own memory usage
- Exit gracefully if approaching OOM

### 4. Retry Logic for Blob Operations
- Azure blob operations can fail transiently
- Add retry with exponential backoff

## Changes Needed for blob_processor.py

### 1. Already Fixed
- Dynamic spawning: `if can_spawn():` (not `while ... < N`)
- 75% thresholds for CPU and memory

### 2. Worker Output Capture
- Currently using PIPE but not reading output
- Should log worker stdout/stderr to files

### 3. Stale Lock Cleanup
- If a worker dies, its lock expires after 5 minutes
- Consider detecting crashed workers and cleaning up faster

## VM Setup Requirements

1. Install psutil: `pip install psutil`
2. Use venv with DECIMER, azure-storage-blob, psutil
3. F16s_v2 (32GB RAM) - expect 3-4 workers at equilibrium
4. E16ds_v5 (128GB RAM) - expect 15-20 workers at equilibrium

## Testing Checklist

- [x] Worker processes single directory end-to-end
- [x] Lock acquired, refreshed, released
- [x] Results uploaded to blob storage
- [x] DECIMER processes images correctly
- [ ] blob_processor.py spawns workers dynamically
- [ ] Memory stays under 75% with dynamic scaling
- [ ] Handles worker crashes gracefully
