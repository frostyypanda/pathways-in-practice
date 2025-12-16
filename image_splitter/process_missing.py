"""
Process directories that are missing output folders.
"""

import time
import sys
from pathlib import Path
from image_splitter import process_batch_parallel

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path(r"D:\chemistry-scraped")
NUM_WORKERS = 8


def main():
    start_time = time.time()

    # Find directories missing output
    all_dirs = [d for d in BASE_DIR.iterdir() if d.is_dir()]
    missing_dirs = []

    for d in all_dirs:
        output_dir = d / "output"
        if not output_dir.exists():
            png_count = len(list(d.glob("*.png")))
            jpg_count = len(list(d.glob("*.jpg")))
            if png_count + jpg_count > 0:
                missing_dirs.append(d)

    print(f"Found {len(missing_dirs)} directories missing output")

    total_success = 0
    total_errors = 0

    for i, dir_path in enumerate(missing_dirs, 1):
        output_dir = dir_path / "output"

        png_files = list(dir_path.glob("*.png"))
        jpg_files = list(dir_path.glob("*.jpg"))
        num_images = len(png_files) + len(jpg_files)

        print(f"[{i}/{len(missing_dirs)}] {dir_path.name}: {num_images} images...", end=" ", flush=True)

        dir_start = time.time()

        success_png, errors_png = process_batch_parallel(
            str(dir_path), str(output_dir), "*.png", NUM_WORKERS
        )
        success_jpg, errors_jpg = process_batch_parallel(
            str(dir_path), str(output_dir), "*.jpg", NUM_WORKERS
        )

        dir_elapsed = time.time() - dir_start
        success = success_png + success_jpg
        errors = errors_png + errors_jpg

        print(f"Done in {dir_elapsed:.1f}s ({success} ok, {errors} errors)")

        total_success += success
        total_errors += errors

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"COMPLETED")
    print(f"{'='*60}")
    print(f"Directories processed: {len(missing_dirs)}")
    print(f"Successful: {total_success}")
    print(f"Errors: {total_errors}")
    print(f"Total time: {elapsed:.1f}s ({elapsed/60:.1f} minutes)")


if __name__ == "__main__":
    main()
