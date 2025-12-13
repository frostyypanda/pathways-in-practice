"""
Process all images in the 1-epiaustraline 3 (Donohoe 2004) directory.
"""

from image_splitter import process_batch

INPUT_DIR = r"D:\chemistry-scraped\1-epiaustraline 3 (Donohoe 2004)"
OUTPUT_DIR = r"D:\chemistry-scraped\1-epiaustraline 3 (Donohoe 2004)\output"

if __name__ == "__main__":
    print(f"Processing images from: {INPUT_DIR}")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    # Process PNG and JPG files
    process_batch(INPUT_DIR, OUTPUT_DIR, "*.png")
    process_batch(INPUT_DIR, OUTPUT_DIR, "*.jpg")

    print("\nDone!")
