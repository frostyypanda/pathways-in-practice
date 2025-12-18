# DECIMER-SMILES Pipeline

Pipeline for converting chemical structure images to SMILES notation using [DECIMER-Image_Transformer](https://github.com/Kohulan/DECIMER-Image_Transformer).

## Project Goal

Convert ~220,000 chemical structure images (PNG) to SMILES strings, with potential pre-processing for image segmentation/cropping.

## Quick Start

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# For GPU support (optional)
pip install -r requirements-gpu.txt

# Run single image prediction
python run_decimer.py --input image.png

# Process a synthesis directory (with confidence scores)
python process_synthesis.py "/path/to/Synthesis Name/"
```

## System Requirements

### Minimum (CPU)
- Python 3.9-3.12
- 8 GB RAM (4.8 GB per instance)
- ~2 GB disk for models (auto-downloaded)

### Recommended (GPU)
- NVIDIA GPU with 8+ GB VRAM
- CUDA 12.x compatible driver

## Performance Benchmarks

Tested on AMD Ryzen 7 7700X + RTX 4060 (8GB):

| Mode | Per Image | Notes |
|------|-----------|-------|
| CPU (single) | ~0.5s | After warm-up |
| CPU (6 parallel) | ~12 img/s | Limited by RAM |
| GPU (single) | ~0.65s | Slightly slower than CPU for this model |

### Parallel Instance Capacity

| System | CPU Instances | GPU Instances |
|--------|--------------|---------------|
| Ryzen 7700X + 30GB RAM + RTX 4060 | 6 | 1 |
| Ryzen 7800X3D + 64GB RAM + RTX 4090 | 12 | 3 |

## Memory Usage

Per DECIMER instance:
- **RAM:** ~4.8 GB
- **GPU VRAM:** ~6.4 GB

## Known Behaviors

### Abbreviation Expansion

DECIMER expands common chemical abbreviations to full structures:

| Image Text | DECIMER Output |
|------------|----------------|
| TIPSO | `CC(C)[Si](C(C)C)(C(C)C)O...` |
| Boc | Full tert-butyloxycarbonyl structure |
| TBS | Full tert-butyldimethylsilyl structure |

This is trained behavior, not post-processing. To preserve abbreviations like `[TIPSO]`, post-processing is needed.

## Project Structure

```
decimer-smiles/
├── run_decimer.py        # Single/batch image prediction
├── process_synthesis.py  # Process synthesis directories with confidence scores
├── requirements.txt      # Core dependencies
├── requirements-gpu.txt  # GPU dependencies (pip-based CUDA)
├── README.md
├── CLAUDE.md             # Claude Code guidance
└── venv/                 # Virtual environment (not committed)
```

## Synthesis Directory Format

Expected input structure:
```
chemistry-scraped/
├── Synthesis Name (Author Year)/
│   └── output/
│       ├── sequence_01_left.png    # Reactant
│       ├── sequence_01_middle.png  # Reagents + arrow
│       ├── sequence_01_right.png   # Product
│       ├── sequence_02_left.png
│       └── ...
```

Output (saved to synthesis directory):
```json
{
  "synthesis": "Synthesis Name (Author Year)",
  "processed_at": "2025-12-13 18:10:33",
  "total_images": 87,
  "successful": 87,
  "failed": 0,
  "entries": [
    {
      "id": "sequence_01_left",
      "file": "sequence_01_left.png",
      "sequence": "01",
      "sub_sequence": null,
      "part": "left",
      "smiles": "COC(=O)CC(=O)OC",
      "confidence": {
        "average": 0.9507,
        "min": 0.8485,
        "per_token": [["C", 0.8485], ["O", 0.954], ...]
      },
      "error": null
    }
  ]
}
```

## TODO

- [x] Single image prediction script
- [x] Synthesis directory batch processing with confidence scores
- [x] JSON output per synthesis folder
- [ ] Parallel processing for 220k images
- [ ] Post-processing for abbreviation preservation (`[TIPSO]`, etc.)
- [ ] Image segmentation/cropping for multi-structure images

## References

- [DECIMER-Image_Transformer](https://github.com/Kohulan/DECIMER-Image_Transformer)
- [DECIMER Web Demo](https://decimer.ai)
- Publication: Rajan et al., Nature Communications (2023)

## License

MIT
