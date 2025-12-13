"""
Process ALL directories in D:\chemistry-scraped using 8 parallel workers.
"""

import time
from pathlib import Path
from image_splitter import process_batch_parallel

BASE_DIR = Path(r"D:\chemistry-scraped")
NUM_WORKERS = 8


def main():
    start_time = time.time()

    # Find all subdirectories
    directories = [d for d in BASE_DIR.iterdir() if d.is_dir()]
    print(f"Found {len(directories)} directories to process")

    total_success = 0
    total_errors = 0
    total_images = 0

    for i, dir_path in enumerate(directories, 1):
        output_dir = dir_path / "output"

        # Count images in this directory
        png_files = list(dir_path.glob("*.png"))
        jpg_files = list(dir_path.glob("*.jpg"))
        num_images = len(png_files) + len(jpg_files)

        if num_images == 0:
            print(f"[{i}/{len(directories)}] {dir_path.name}: No images, skipping")
            continue

        print(f"[{i}/{len(directories)}] {dir_path.name}: {num_images} images...", end=" ", flush=True)

        dir_start = time.time()

        # Process PNG files
        success_png, errors_png = process_batch_parallel(
            str(dir_path), str(output_dir), "*.png", NUM_WORKERS
        )

        # Process JPG files
        success_jpg, errors_jpg = process_batch_parallel(
            str(dir_path), str(output_dir), "*.jpg", NUM_WORKERS
        )

        dir_elapsed = time.time() - dir_start
        success = success_png + success_jpg
        errors = errors_png + errors_jpg

        print(f"Done in {dir_elapsed:.1f}s ({success} ok, {errors} errors)")

        total_success += success
        total_errors += errors
        total_images += num_images

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"COMPLETED")
    print(f"{'='*60}")
    print(f"Total images: {total_images}")
    print(f"Successful: {total_success}")
    print(f"Errors: {total_errors}")
    print(f"Total time: {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
    if total_images > 0:
        print(f"Average: {elapsed/total_images*1000:.1f}ms per image")


if __name__ == "__main__":
    main()
