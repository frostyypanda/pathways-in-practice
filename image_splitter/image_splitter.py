"""
Image splitter that extracts sections from chemistry reaction screenshots.

1. Removes header and footer (orange UI bars)
2. Splits the content area into Left, Middle, Right along white pixel columns

==============================================================================
CRITICAL RULES - MUST FOLLOW WHEN MODIFYING THIS SCRIPT:
==============================================================================
1. Header and footer detection must ALWAYS be dynamic
2. Scan from top to find where orange header ends
3. Scan from bottom to find where orange footer starts
4. NEVER hardcode pixel positions, heights, or percentages
5. Each image may have different dimensions - detect everything dynamically
6. The only acceptable "constants" are color detection thresholds for orange
==============================================================================
"""

from PIL import Image
import numpy as np
from pathlib import Path
from multiprocessing import Pool
from functools import partial


def is_orange_pixel(pixel) -> bool:
    """Check if a pixel is orange (high R, medium G, low B)."""
    r, g, b = int(pixel[0]), int(pixel[1]), int(pixel[2])
    # Orange has R much higher than B, and G somewhere in between
    return r > 200 and 50 < g < 200 and b < 150


def row_has_orange(row) -> bool:
    """Check if a row has any orange pixels."""
    for pixel in row:
        if is_orange_pixel(pixel):
            return True
    return False


def find_content_bounds(img_array: np.ndarray) -> tuple[int, int]:
    """
    Find the top and bottom bounds of the main content by detecting
    orange UI bars dynamically.

    Scans from top to find where header ends.
    Scans from bottom to find where footer starts.

    Returns (top_y, bottom_y) coordinates.
    """
    height = img_array.shape[0]

    # Find header bottom: scan from top until we pass through orange area
    top_y = 0
    in_header = False
    for y in range(height):
        row = img_array[y]
        if row_has_orange(row):
            in_header = True
            top_y = y + 1  # 1 pixel below this orange row
        elif in_header:
            # We were in header and now hit non-orange, header is done
            break

    # Find footer top: scan from bottom up until we pass through orange area
    bottom_y = height
    in_footer = False
    for y in range(height - 1, -1, -1):
        row = img_array[y]
        if row_has_orange(row):
            in_footer = True
        elif in_footer:
            # We passed through orange footer and hit content area
            bottom_y = y + 1  # Cut 1 pixel above the footer
            break

    return top_y, bottom_y


def is_column_completely_white(img_array: np.ndarray, x: int, threshold: int = 250) -> bool:
    """Check if a column is COMPLETELY white (all pixels white)."""
    col = img_array[:, x]
    return np.all(col > threshold)


def find_white_column_splits(img_array: np.ndarray, threshold: int = 250) -> list[int]:
    """
    Find vertical split points by scanning from center outward.

    Starts at the center pixel and scans:
    - LEFT until finding first completely white column
    - RIGHT until finding first completely white column

    Returns [left_split, right_split] x-coordinates.
    """
    height, width = img_array.shape[:2]
    center = width // 2

    # Scan LEFT from center to find first completely white column
    left_split = None
    for x in range(center, -1, -1):
        if is_column_completely_white(img_array, x, threshold):
            left_split = x
            break

    # Scan RIGHT from center to find first completely white column
    right_split = None
    for x in range(center, width):
        if is_column_completely_white(img_array, x, threshold):
            right_split = x
            break

    # Handle cases where no white column was found
    if left_split is None:
        left_split = width // 3
    if right_split is None:
        right_split = 2 * width // 3

    return [left_split, right_split]


def split_image(image_path: str, output_dir: str = None, verbose: bool = True) -> dict[str, Image.Image]:
    """
    Split an image into Left, Middle, Right sections.

    1. Remove header/footer (orange UI bars)
    2. Split the content area into 3 parts along white vertical lines

    Args:
        image_path: Path to the input image
        output_dir: Optional directory to save the output images
        verbose: Print progress messages

    Returns:
        Dictionary with 'left', 'middle', 'right' keys and PIL Image values
    """
    img = Image.open(image_path).convert('RGB')
    img_array = np.array(img)

    height, width = img_array.shape[:2]

    # Step 1: Find content bounds (remove header/footer)
    top_y, bottom_y = find_content_bounds(img_array)

    # Step 2: Extract content area (full height between header and footer)
    content = img_array[top_y:bottom_y, :]

    # Step 3: Find white column splits in the content area
    splits = find_white_column_splits(content)

    if verbose:
        print(f"Content bounds: top={top_y}, bottom={bottom_y}")
        print(f"Content area: y={top_y} to {bottom_y}")
        print(f"Split points: x={splits}")

    # Step 4: Cut into Left, Middle, Right
    results = {}

    left_img = img.crop((0, top_y, splits[0], bottom_y))
    middle_img = img.crop((splits[0], top_y, splits[1], bottom_y))
    right_img = img.crop((splits[1], top_y, width, bottom_y))

    results['left'] = left_img
    results['middle'] = middle_img
    results['right'] = right_img

    # Save if output directory specified
    if output_dir:
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        stem = Path(image_path).stem
        left_img.save(out_path / f"{stem}_left.png")
        middle_img.save(out_path / f"{stem}_middle.png")
        right_img.save(out_path / f"{stem}_right.png")
        if verbose:
            print(f"Saved to {out_path}")

    return results


def _process_single_image(args: tuple) -> tuple[str, bool, str]:
    """Worker function for parallel processing. Returns (filename, success, error_msg)."""
    image_path, output_dir = args
    try:
        split_image(image_path, output_dir, verbose=False)
        return (Path(image_path).name, True, "")
    except Exception as e:
        return (Path(image_path).name, False, str(e))


def process_batch(input_dir: str, output_dir: str, pattern: str = "*.png"):
    """Process all matching images in a directory (sequential)."""
    input_path = Path(input_dir)
    for img_file in input_path.glob(pattern):
        print(f"\nProcessing: {img_file.name}")
        try:
            split_image(str(img_file), output_dir)
        except Exception as e:
            print(f"  Error: {e}")


def process_batch_parallel(input_dir: str, output_dir: str, pattern: str = "*.png", num_workers: int = 8):
    """Process all matching images in a directory using parallel workers."""
    input_path = Path(input_dir)
    image_files = list(input_path.glob(pattern))

    if not image_files:
        return 0, 0

    # Create output directory
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    # Prepare arguments for workers
    args = [(str(img_file), output_dir) for img_file in image_files]

    # Process in parallel
    success_count = 0
    error_count = 0

    with Pool(num_workers) as pool:
        for filename, success, error_msg in pool.imap_unordered(_process_single_image, args):
            if success:
                success_count += 1
            else:
                error_count += 1
                print(f"  Error processing {filename}: {error_msg}")

    return success_count, error_count


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python image_splitter.py <image_path> [output_dir]")
        print("       python image_splitter.py --batch <input_dir> <output_dir> [pattern]")
        sys.exit(1)

    if sys.argv[1] == "--batch":
        if len(sys.argv) < 4:
            print("Batch mode requires input_dir and output_dir")
            sys.exit(1)
        pattern = sys.argv[4] if len(sys.argv) > 4 else "*.png"
        process_batch(sys.argv[2], sys.argv[3], pattern)
    else:
        output_dir = sys.argv[2] if len(sys.argv) > 2 else "./output"
        split_image(sys.argv[1], output_dir)
