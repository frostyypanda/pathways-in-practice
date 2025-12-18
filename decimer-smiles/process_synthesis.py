#!/usr/bin/env python3
"""
Process a synthesis directory and convert all chemical structure images to SMILES.
Outputs a JSON file with SMILES and confidence scores for each image.
"""

import argparse
import json
import os
import re
import site
import sys
import time
from pathlib import Path
from typing import Optional


def setup_gpu_environment():
    """Configure library paths for GPU support (pip-installed CUDA)."""
    sp = site.getsitepackages()[0]
    nvidia_dir = f"{sp}/nvidia"

    if os.path.exists(nvidia_dir):
        lib_dirs = ["cudnn", "cublas", "cuda_runtime", "cuda_nvrtc", "cufft",
                    "cusolver", "cusparse", "nccl", "nvjitlink"]
        lib_paths = [f"{nvidia_dir}/{d}/lib" for d in lib_dirs]
        existing_paths = [p for p in lib_paths if os.path.exists(p)]
        if existing_paths:
            os.environ["LD_LIBRARY_PATH"] = ":".join(existing_paths) + ":" + os.environ.get("LD_LIBRARY_PATH", "")
            os.environ["XLA_FLAGS"] = f"--xla_gpu_cuda_data_dir={nvidia_dir}/cuda_nvcc"
            return True
    return False


def parse_filename(filename: str) -> dict:
    """
    Parse image filename to extract sequence info.

    Examples:
        sequence_01_left.png -> {sequence: "01", sub: None, part: "left"}
        sequence_10_sub_01_right.png -> {sequence: "10", sub: "01", part: "right"}
    """
    stem = Path(filename).stem

    # Pattern for sub-sequences: sequence_XX_sub_YY_part
    sub_match = re.match(r'sequence_(\d+)_sub_(\d+)_(left|middle|right)', stem)
    if sub_match:
        return {
            "sequence": sub_match.group(1),
            "sub": sub_match.group(2),
            "part": sub_match.group(3)
        }

    # Pattern for regular sequences: sequence_XX_part
    match = re.match(r'sequence_(\d+)_(left|middle|right)', stem)
    if match:
        return {
            "sequence": match.group(1),
            "sub": None,
            "part": match.group(2)
        }

    return None


def predict_with_confidence(image_path: str, hand_drawn: bool = False) -> dict:
    """Predict SMILES with confidence scores."""
    from DECIMER import predict_SMILES

    try:
        smiles, confidence_data = predict_SMILES(
            image_path,
            confidence=True,
            hand_drawn=hand_drawn
        )

        # Calculate average confidence (convert numpy float32 to Python float)
        if confidence_data:
            confidences = [float(c) for _, c in confidence_data]
            avg_confidence = sum(confidences) / len(confidences)
            min_confidence = min(confidences)
        else:
            avg_confidence = None
            min_confidence = None

        return {
            "smiles": smiles,
            "confidence": {
                "average": round(avg_confidence, 4) if avg_confidence is not None else None,
                "min": round(min_confidence, 4) if min_confidence is not None else None,
                "per_token": [(tok, round(float(conf), 4)) for tok, conf in confidence_data] if confidence_data else None
            },
            "error": None
        }
    except Exception as e:
        return {
            "smiles": None,
            "confidence": None,
            "error": str(e)
        }


def process_synthesis(synthesis_dir: Path, hand_drawn: bool = False, verbose: bool = True) -> dict:
    """
    Process all images in a synthesis directory.

    Args:
        synthesis_dir: Path to synthesis directory (contains output/ subdirectory)
        hand_drawn: Use hand-drawn model
        verbose: Print progress

    Returns:
        dict with synthesis results
    """
    output_dir = synthesis_dir / "output"

    if not output_dir.exists():
        raise FileNotFoundError(f"No output directory found in {synthesis_dir}")

    # Find all PNG files
    image_files = sorted(output_dir.glob("*.png"))

    if not image_files:
        raise FileNotFoundError(f"No PNG files found in {output_dir}")

    if verbose:
        print(f"Processing {len(image_files)} images from: {synthesis_dir.name}")

    results = {
        "synthesis": synthesis_dir.name,
        "processed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_images": len(image_files),
        "entries": []
    }

    # Process with progress bar if available
    try:
        from tqdm import tqdm
        iterator = tqdm(image_files, desc="Processing", disable=not verbose)
    except ImportError:
        iterator = image_files

    for img_path in iterator:
        parsed = parse_filename(img_path.name)

        if parsed is None:
            if verbose:
                print(f"  Skipping unrecognized filename: {img_path.name}")
            continue

        # Build entry ID
        if parsed["sub"]:
            entry_id = f"sequence_{parsed['sequence']}_sub_{parsed['sub']}_{parsed['part']}"
        else:
            entry_id = f"sequence_{parsed['sequence']}_{parsed['part']}"

        # Predict SMILES
        prediction = predict_with_confidence(str(img_path), hand_drawn=hand_drawn)

        entry = {
            "id": entry_id,
            "file": img_path.name,
            "sequence": parsed["sequence"],
            "sub_sequence": parsed["sub"],
            "part": parsed["part"],
            "smiles": prediction["smiles"],
            "confidence": prediction["confidence"],
            "error": prediction["error"]
        }

        results["entries"].append(entry)

    # Summary stats
    successful = sum(1 for e in results["entries"] if e["smiles"])
    results["successful"] = successful
    results["failed"] = len(results["entries"]) - successful

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Process synthesis directory and convert images to SMILES"
    )
    parser.add_argument(
        "synthesis_dir",
        help="Path to synthesis directory (containing output/ subdirectory)"
    )
    parser.add_argument(
        "--output", "-o",
        help="Output JSON file path (default: synthesis_dir/smiles_output.json)"
    )
    parser.add_argument(
        "--hand-drawn",
        action="store_true",
        help="Use hand-drawn structure model"
    )
    parser.add_argument(
        "--no-gpu",
        action="store_true",
        help="Disable GPU, use CPU only"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress progress output"
    )

    args = parser.parse_args()

    # Setup GPU
    if not args.no_gpu:
        setup_gpu_environment()
    else:
        os.environ["CUDA_VISIBLE_DEVICES"] = ""

    synthesis_dir = Path(args.synthesis_dir)

    if not synthesis_dir.exists():
        print(f"Error: Directory not found: {synthesis_dir}")
        sys.exit(1)

    # Process
    start_time = time.time()
    results = process_synthesis(
        synthesis_dir,
        hand_drawn=args.hand_drawn,
        verbose=not args.quiet
    )
    elapsed = time.time() - start_time

    # Output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = synthesis_dir / "smiles_output.json"

    # Save JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nCompleted in {elapsed:.1f}s")
    print(f"Processed: {results['successful']}/{results['total_images']} successful")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
