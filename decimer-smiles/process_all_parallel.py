#!/usr/bin/env python3
"""
Parallel processing of all synthesis directories.
Uses multiprocessing to run multiple DECIMER instances concurrently.

Usage:
    python process_all_parallel.py /path/to/chemistry-scraped --workers 12
"""

import argparse
import json
import multiprocessing as mp
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# Must be set before importing TensorFlow
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"  # Suppress TF warnings


def setup_environment():
    """Configure environment for DECIMER (works on both Linux and Windows)."""
    import site

    # Suppress TensorFlow warnings
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

    # Linux: Set up pip-installed CUDA libraries
    if sys.platform.startswith('linux'):
        sp = site.getsitepackages()[0]
        nvidia_dir = f"{sp}/nvidia"
        if os.path.exists(nvidia_dir):
            lib_dirs = ["cudnn", "cublas", "cuda_runtime", "cuda_nvrtc", "cufft",
                        "cusolver", "cusparse", "nccl", "nvjitlink"]
            lib_paths = [f"{nvidia_dir}/{d}/lib" for d in lib_dirs]
            existing = [p for p in lib_paths if os.path.exists(p)]
            if existing:
                os.environ["LD_LIBRARY_PATH"] = ":".join(existing) + ":" + os.environ.get("LD_LIBRARY_PATH", "")
                os.environ["XLA_FLAGS"] = f"--xla_gpu_cuda_data_dir={nvidia_dir}/cuda_nvcc"

    # Force CPU mode for parallel processing (GPU doesn't help with parallelization)
    os.environ["CUDA_VISIBLE_DEVICES"] = ""


def process_single_synthesis(args: tuple) -> dict:
    """
    Process a single synthesis directory. Designed to run in a worker process.

    Args:
        args: Tuple of (synthesis_path, worker_id, hand_drawn)

    Returns:
        dict with processing results
    """
    synthesis_path, worker_id, hand_drawn = args
    synthesis_dir = Path(synthesis_path)

    result = {
        "synthesis": synthesis_dir.name,
        "path": str(synthesis_dir),
        "worker_id": worker_id,
        "status": "pending",
        "images_processed": 0,
        "images_failed": 0,
        "time_seconds": 0,
        "error": None
    }

    try:
        # Setup environment in this worker process
        setup_environment()

        # Import here to ensure each worker has its own TF instance
        import tensorflow as tf
        tf.get_logger().setLevel('ERROR')

        # Import processing function
        from process_synthesis import process_synthesis

        output_dir = synthesis_dir / "output"
        output_file = synthesis_dir / "smiles_output.json"

        # Skip if already processed
        if output_file.exists():
            result["status"] = "skipped"
            result["error"] = "Already processed"
            return result

        # Skip if no output directory
        if not output_dir.exists():
            result["status"] = "skipped"
            result["error"] = "No output directory"
            return result

        # Count images
        image_files = list(output_dir.glob("*.png"))
        if not image_files:
            result["status"] = "skipped"
            result["error"] = "No PNG files"
            return result

        # Process
        start_time = time.time()
        synthesis_result = process_synthesis(
            synthesis_dir,
            hand_drawn=hand_drawn,
            verbose=False
        )
        elapsed = time.time() - start_time

        # Save JSON output
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(synthesis_result, f, indent=2, ensure_ascii=False)

        result["status"] = "completed"
        result["images_processed"] = synthesis_result.get("successful", 0)
        result["images_failed"] = synthesis_result.get("failed", 0)
        result["time_seconds"] = round(elapsed, 1)

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)

    return result


def get_pending_syntheses(root_dir: Path) -> list:
    """Get list of synthesis directories that haven't been processed yet."""
    pending = []

    for item in sorted(root_dir.iterdir()):
        if not item.is_dir():
            continue

        output_dir = item / "output"
        output_file = item / "smiles_output.json"

        # Skip if already processed
        if output_file.exists():
            continue

        # Skip if no output directory with images
        if not output_dir.exists():
            continue

        if not list(output_dir.glob("*.png")):
            continue

        pending.append(item)

    return pending


def format_time(seconds: float) -> str:
    """Format seconds as human-readable time."""
    return str(timedelta(seconds=int(seconds)))


def main():
    parser = argparse.ArgumentParser(
        description="Process all synthesis directories in parallel"
    )
    parser.add_argument(
        "root_dir",
        help="Root directory containing synthesis folders"
    )
    parser.add_argument(
        "--workers", "-w",
        type=int,
        default=6,
        help="Number of parallel workers (default: 6, use 12 for 64GB RAM)"
    )
    parser.add_argument(
        "--hand-drawn",
        action="store_true",
        help="Use hand-drawn structure model"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of syntheses to process (for testing)"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        default=True,
        help="Skip already processed directories (default: True)"
    )

    args = parser.parse_args()
    root_dir = Path(args.root_dir)

    if not root_dir.exists():
        print(f"Error: Directory not found: {root_dir}")
        sys.exit(1)

    # Get list of syntheses to process
    print(f"Scanning {root_dir}...")

    # Count directories properly
    all_dirs = [d for d in sorted(root_dir.iterdir()) if d.is_dir()]
    with_output = [d for d in all_dirs if (d / "output").exists() and list((d / "output").glob("*.png"))]
    already_done = [d for d in with_output if (d / "smiles_output.json").exists()]
    pending = [d for d in with_output if not (d / "smiles_output.json").exists()]

    if args.limit:
        pending = pending[:args.limit]

    print(f"\n{'='*60}")
    print(f"DECIMER Parallel Processing")
    print(f"{'='*60}")
    print(f"Root directory:    {root_dir}")
    print(f"Total directories: {len(all_dirs)}")
    print(f"With output/PNGs:  {len(with_output)}")
    print(f"Already processed: {len(already_done)}")
    print(f"To process:        {len(pending)}")
    print(f"Workers:           {args.workers}")
    print(f"{'='*60}\n")

    if not pending:
        print("Nothing to process. All syntheses already have smiles_output.json")
        return

    # Estimate time
    avg_images_per_synthesis = 50  # rough estimate
    avg_time_per_image = 2.7  # seconds, from our benchmarks
    total_images_est = len(pending) * avg_images_per_synthesis
    time_est = (total_images_est * avg_time_per_image) / args.workers
    print(f"Estimated time: {format_time(time_est)} (rough estimate)")
    print(f"Starting at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Prepare work items
    work_items = [
        (str(synthesis_dir), i % args.workers, args.hand_drawn)
        for i, synthesis_dir in enumerate(pending)
    ]

    # Process in parallel
    start_time = time.time()
    completed = 0
    failed = 0
    total_images = 0

    # Use spawn method for better compatibility (especially Windows)
    ctx = mp.get_context('spawn')

    try:
        with ctx.Pool(processes=args.workers) as pool:
            # Use imap for progress updates
            for result in pool.imap_unordered(process_single_synthesis, work_items):
                if result["status"] == "completed":
                    completed += 1
                    total_images += result["images_processed"]
                    elapsed = time.time() - start_time
                    rate = total_images / elapsed if elapsed > 0 else 0
                    remaining = len(pending) - completed - failed
                    eta = remaining * (elapsed / max(completed, 1))

                    print(f"[{completed + failed}/{len(pending)}] "
                          f"✓ {result['synthesis'][:40]:<40} "
                          f"({result['images_processed']} imgs, {result['time_seconds']:.0f}s) "
                          f"ETA: {format_time(eta)}")

                elif result["status"] == "error":
                    failed += 1
                    print(f"[{completed + failed}/{len(pending)}] "
                          f"✗ {result['synthesis'][:40]:<40} "
                          f"ERROR: {result['error'][:50]}")

                elif result["status"] == "skipped":
                    # Don't count skipped in progress
                    pass

    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Progress has been saved.")
        print("Run again with --resume to continue.")

    # Summary
    total_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"COMPLETED")
    print(f"{'='*60}")
    print(f"Syntheses processed: {completed}")
    print(f"Syntheses failed:    {failed}")
    print(f"Total images:        {total_images}")
    print(f"Total time:          {format_time(total_time)}")
    if total_images > 0:
        print(f"Average per image:   {total_time/total_images:.2f}s")
        print(f"Images per second:   {total_images/total_time:.2f}")
    print(f"{'='*60}")

    # Save run summary
    summary_file = root_dir / f"processing_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    summary = {
        "completed_at": datetime.now().isoformat(),
        "root_dir": str(root_dir),
        "workers": args.workers,
        "syntheses_processed": completed,
        "syntheses_failed": failed,
        "total_images": total_images,
        "total_time_seconds": round(total_time, 1),
        "avg_time_per_image": round(total_time / max(total_images, 1), 2)
    }
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nSummary saved to: {summary_file}")


if __name__ == "__main__":
    # Required for Windows multiprocessing
    mp.freeze_support()
    main()
