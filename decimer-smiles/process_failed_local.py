#!/usr/bin/env python3
"""
Process failed syntheses locally, storing results in PostgreSQL.

Checks database for existing results, only processes what's missing.

Usage:
    python process_failed_local.py                    # Process all failed
    python process_failed_local.py --limit 5         # Process only first 5
    python process_failed_local.py --threads 2       # Use 2 threads (default)
    python process_failed_local.py --dry-run         # List what would be processed
"""

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock
from datetime import datetime

import psycopg2

# Add azure dir to path for db_config
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR / "azure"))
from db_config import DB_CONFIG

# Paths
FAILED_LIST = SCRIPT_DIR / "azure" / "failed_syntheses.txt"
IMAGES_BASE = Path("/mnt/d/chemistry-scraped")

# Thread-safe print lock
print_lock = Lock()


def log(msg: str, level: str = "INFO"):
    """Thread-safe logging with timestamp."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    with print_lock:
        print(f"[{timestamp}] [{level}] {msg}", flush=True)


def get_db_connection():
    """Get PostgreSQL connection."""
    return psycopg2.connect(**DB_CONFIG)


def get_synthesis_id(synthesis_name: str) -> int:
    """Get synthesis ID from name."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM synthesis WHERE name = %s", (synthesis_name,))
        result = cur.fetchone()
        return result[0] if result else None
    finally:
        cur.close()
        conn.close()


def get_existing_results_count(synthesis_id: int) -> int:
    """Check how many results exist for a synthesis."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT COUNT(*) FROM smiles_results WHERE synthesis_id = %s",
            (synthesis_id,)
        )
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()


def save_smiles_result(conn, synthesis_id: int, image_filename: str, smiles: str,
                       smiles_confidence: float, error: str, duration_ms: int, worker_id: str):
    """Save SMILES result to database using existing connection."""
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO smiles_results
                (synthesis_id, image_filename, smiles, smiles_confidence, error, duration_ms, worker_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (synthesis_id, image_filename) DO UPDATE SET
                smiles = EXCLUDED.smiles,
                smiles_confidence = EXCLUDED.smiles_confidence,
                error = EXCLUDED.error,
                duration_ms = EXCLUDED.duration_ms,
                worker_id = EXCLUDED.worker_id,
                processed_at = NOW()
        """, (synthesis_id, image_filename, smiles, smiles_confidence, error, duration_ms, worker_id))
        conn.commit()
    finally:
        cur.close()


def mark_synthesis_completed(synthesis_name: str, worker_id: str, successful: int, failed: int, image_count: int):
    """Mark synthesis as completed in database."""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE synthesis
            SET status = 'completed',
                completed_at = NOW(),
                worker_id = %s,
                successful = %s,
                failed = %s,
                image_count = %s
            WHERE name = %s
        """, (worker_id, successful, failed, image_count, synthesis_name))
    finally:
        cur.close()
        conn.close()


def process_single_synthesis(synthesis_name: str, worker_id: str) -> dict:
    """
    Process a single synthesis directory, saving results to database.
    Uses a single DB connection per synthesis for efficiency.
    """
    result = {
        "name": synthesis_name,
        "worker": worker_id,
        "status": "unknown",
        "successful": 0,
        "failed": 0,
        "total": 0,
        "skipped": False,
        "error": None,
        "elapsed": 0
    }

    start_time = time.time()
    conn = None

    try:
        # Get DB connection for this synthesis (reused for all images)
        conn = get_db_connection()

        # Get synthesis ID from database
        synthesis_id = get_synthesis_id(synthesis_name)
        if not synthesis_id:
            result["status"] = "error"
            result["error"] = "Synthesis not found in database"
            log(f"[{worker_id}] SKIP {synthesis_name}: not in database", "ERROR")
            return result

        # Check local directory
        synthesis_dir = IMAGES_BASE / synthesis_name
        if not synthesis_dir.exists():
            result["status"] = "error"
            result["error"] = "Directory not found locally"
            log(f"[{worker_id}] SKIP {synthesis_name}: dir not found", "ERROR")
            return result

        output_dir = synthesis_dir / "output"
        if not output_dir.exists():
            result["status"] = "error"
            result["error"] = "No output/ subdirectory"
            log(f"[{worker_id}] SKIP {synthesis_name}: no output/", "ERROR")
            return result

        # Count local images
        image_files = sorted(output_dir.glob("*.png"))
        result["total"] = len(image_files)

        if not image_files:
            result["status"] = "error"
            result["error"] = "No PNG files"
            log(f"[{worker_id}] SKIP {synthesis_name}: no images", "ERROR")
            return result

        # Check if already has results in database
        existing_count = get_existing_results_count(synthesis_id)
        if existing_count >= len(image_files):
            result["status"] = "skipped"
            result["skipped"] = True
            result["successful"] = existing_count
            log(f"[{worker_id}] SKIP {synthesis_name}: already has {existing_count} results in DB")
            return result

        log(f"[{worker_id}] START {synthesis_name} ({len(image_files)} images, {existing_count} existing)")

        # Import DECIMER (heavy, only when needed)
        from DECIMER import predict_SMILES

        successful = 0
        failed = 0

        for i, img_path in enumerate(image_files):
            img_start = time.time()

            try:
                # Get SMILES with confidence
                smiles, char_confidences = predict_SMILES(str(img_path), confidence=True)
                duration_ms = int((time.time() - img_start) * 1000)

                # Calculate average confidence
                if char_confidences:
                    avg_confidence = sum(float(c[1]) for c in char_confidences) / len(char_confidences)
                else:
                    avg_confidence = None

                # Save to database (reusing connection)
                save_smiles_result(
                    conn,
                    synthesis_id=synthesis_id,
                    image_filename=img_path.name,
                    smiles=smiles,
                    smiles_confidence=avg_confidence,
                    error=None,
                    duration_ms=duration_ms,
                    worker_id=worker_id
                )
                successful += 1

            except Exception as e:
                duration_ms = int((time.time() - img_start) * 1000)
                save_smiles_result(
                    conn,
                    synthesis_id=synthesis_id,
                    image_filename=img_path.name,
                    smiles=None,
                    smiles_confidence=None,
                    error=str(e),
                    duration_ms=duration_ms,
                    worker_id=worker_id
                )
                failed += 1

            # Progress every 20 images
            if (i + 1) % 20 == 0:
                log(f"[{worker_id}] {synthesis_name}: {i+1}/{len(image_files)}")

        # Mark synthesis as completed
        mark_synthesis_completed(synthesis_name, worker_id, successful, failed, len(image_files))

        result["status"] = "completed"
        result["successful"] = successful
        result["failed"] = failed
        result["elapsed"] = round(time.time() - start_time, 1)

        log(f"[{worker_id}] DONE {synthesis_name}: {successful}/{len(image_files)} OK in {result['elapsed']}s")

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        result["elapsed"] = round(time.time() - start_time, 1)
        log(f"[{worker_id}] FAIL {synthesis_name}: {e}", "ERROR")

    finally:
        if conn:
            conn.close()

    return result


def load_failed_list(limit: int = None) -> list:
    """Load failed synthesis names from file."""
    if not FAILED_LIST.exists():
        raise FileNotFoundError(f"Failed list not found: {FAILED_LIST}")

    with open(FAILED_LIST) as f:
        names = [line.strip() for line in f if line.strip()]

    if limit:
        names = names[:limit]

    return names


def main():
    parser = argparse.ArgumentParser(
        description="Process failed syntheses locally, save to PostgreSQL"
    )
    parser.add_argument(
        "--threads", "-t",
        type=int,
        default=2,
        help="Number of parallel threads (default: 2)"
    )
    parser.add_argument(
        "--limit", "-l",
        type=int,
        default=None,
        help="Limit to first N syntheses (default: all)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List syntheses without processing"
    )

    args = parser.parse_args()

    # Load failed list
    try:
        syntheses = load_failed_list(args.limit)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    if not syntheses:
        print("No syntheses to process.")
        return

    # Test database connection
    try:
        conn = get_db_connection()
        conn.close()
        log("Database connection OK")
    except Exception as e:
        log(f"Database connection failed: {e}", "ERROR")
        sys.exit(1)

    # Dry run - check what needs processing
    if args.dry_run:
        print(f"Checking {len(syntheses)} syntheses against database...\n")
        needs_processing = 0
        already_done = 0

        for name in syntheses:
            synthesis_id = get_synthesis_id(name)
            if not synthesis_id:
                print(f"  [NOT IN DB] {name}")
                continue

            local_dir = IMAGES_BASE / name / "output"
            if not local_dir.exists():
                print(f"  [NO LOCAL]  {name}")
                continue

            local_images = len(list(local_dir.glob("*.png")))
            db_results = get_existing_results_count(synthesis_id)

            if db_results >= local_images:
                print(f"  [DONE {db_results:3d}/{local_images:3d}] {name}")
                already_done += 1
            else:
                print(f"  [NEED {db_results:3d}/{local_images:3d}] {name}")
                needs_processing += 1

        print(f"\n--- Summary ---")
        print(f"Already done: {already_done}")
        print(f"Needs processing: {needs_processing}")
        return

    # Pre-load DECIMER model
    log("Pre-loading DECIMER model...")
    try:
        from DECIMER import predict_SMILES
        log("DECIMER model loaded")
    except Exception as e:
        log(f"Failed to load DECIMER: {e}", "ERROR")
        sys.exit(1)

    # Process
    log(f"Processing {len(syntheses)} syntheses with {args.threads} threads")
    log(f"Images: {IMAGES_BASE}")
    log(f"Database: {DB_CONFIG['host']}")
    log("-" * 60)

    start_time = time.time()
    results = []
    completed = 0
    skipped = 0
    errors = 0

    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        future_to_name = {
            executor.submit(process_single_synthesis, name, f"local-{i % args.threads}"): name
            for i, name in enumerate(syntheses)
        }

        for future in as_completed(future_to_name):
            result = future.result()
            results.append(result)

            if result["status"] == "completed":
                completed += 1
            elif result["status"] == "skipped":
                skipped += 1
            else:
                errors += 1

            total = len(syntheses)
            done = completed + skipped + errors
            pct = done / total * 100
            log(f"Progress: {done}/{total} ({pct:.1f}%) - {completed} processed, {skipped} skipped, {errors} errors")

    elapsed = time.time() - start_time
    log("-" * 60)
    log(f"COMPLETE in {elapsed:.1f}s: {completed} processed, {skipped} skipped, {errors} errors")

    if errors > 0:
        log(f"\nErrors ({errors}):", "ERROR")
        for r in results:
            if r["status"] == "error":
                log(f"  - {r['name']}: {r['error']}", "ERROR")


if __name__ == "__main__":
    main()
