# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pipeline for converting ~220,000 chemical structure images (PNG) to SMILES notation using DECIMER-Image_Transformer. The DECIMER model uses EfficientNet-V2 encoder + Transformer decoder trained on chemical structure images.

## Commands

```bash
# Setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-gpu.txt  # Optional, for GPU support

# Run single prediction
python run_decimer.py --input image.png
python run_decimer.py --input ./images/ --output results.csv
python run_decimer.py --info  # Show GPU/device info

# Process synthesis directory (outputs JSON with confidence scores)
python process_synthesis.py "/path/to/Synthesis Name (Author Year)/"
python process_synthesis.py "/path/to/synthesis/" --hand-drawn  # For hand-drawn
python process_synthesis.py "/path/to/synthesis/" --no-gpu      # Force CPU
```

## Architecture

**run_decimer.py** - Simple prediction script:
- `setup_gpu_environment()` - Configures LD_LIBRARY_PATH and XLA_FLAGS for pip-installed CUDA
- `predict_single()` / `predict_batch()` - Wraps DECIMER's `predict_SMILES()`
- Outputs to stdout/CSV/JSON

**process_synthesis.py** - Batch synthesis processing:
- Expects `output/` subdirectory with `sequence_XX_left|middle|right.png` files
- Parses filenames to extract sequence/sub_sequence/part metadata
- Returns SMILES with per-token confidence scores
- Outputs JSON to synthesis directory as `smiles_output.json`

**DECIMER library** (external):
- Models auto-download to `~/.data/DECIMER-V2/` on first use (~2GB)
- Two models available: standard and hand-drawn structure recognition

## Resource Constraints

Per DECIMER instance:
- **RAM:** ~4.8 GB
- **GPU VRAM:** ~6.4 GB

Parallel capacity (30GB RAM system):
- CPU mode: 6 concurrent instances
- GPU mode: 1 instance per 8GB VRAM

## Known Model Behavior

DECIMER expands chemical abbreviations to full SMILES structures (trained behavior, not post-processing):
- `TIPSO` → `CC(C)[Si](C(C)C)(C(C)C)O...`
- `Boc`, `TBS`, etc. → full structures

To preserve abbreviations like `[TIPSO]`, post-processing must be added.
