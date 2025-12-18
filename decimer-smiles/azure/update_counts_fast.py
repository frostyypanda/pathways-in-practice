#!/usr/bin/env python3
"""Fast update - count from local files, batch update PostgreSQL."""

import os
from pathlib import Path
import psycopg2
from db_config import DB_CONFIG

LOCAL_PATH = Path("/mnt/d/chemistry-scraped")

def main():
    # Count images in each output folder locally
    counts = {}
    for d in LOCAL_PATH.iterdir():
        if d.is_dir():
            output_dir = d / "output"
            if output_dir.exists():
                count = sum(1 for f in output_dir.iterdir()
                           if f.suffix.lower() in ('.png', '.jpg', '.jpeg'))
            else:
                count = 0
            counts[d.name] = count

    print(f"Counted {len(counts)} directories, {sum(counts.values())} total images")

    # Batch update PostgreSQL
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Use executemany for speed
    data = [(count, name) for name, count in counts.items()]
    cur.executemany("UPDATE synthesis SET image_count = %s WHERE name = %s", data)

    conn.commit()
    print(f"Updated {cur.rowcount} rows")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
