#!/usr/bin/env python3
"""
Worker script - processes a single directory using PostgreSQL for coordination
Usage: python worker.py <directory_name> <worker_id>
"""

import sys
import time
import tempfile
import traceback
from pathlib import Path

import psycopg2
from azure.storage.blob import BlobServiceClient

# Import config
from db_config import DB_CONFIG, BLOB_CONNECTION_STRING, BLOB_CONTAINER


def log_to_db(worker_id: str, directory: str, level: str, message: str, tb: str = None):
    """Log message to database."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO logs (worker_id, directory, level, message, traceback)
            VALUES (%s, %s, %s, %s, %s)
        """, (worker_id, directory, level, message, tb))
        cur.close()
        conn.close()
    except:
        pass  # Don't fail if logging fails


def get_db_connection():
    """Get PostgreSQL connection."""
    return psycopg2.connect(**DB_CONFIG)


def get_synthesis_id(directory: str) -> int:
    """Get synthesis ID from directory name."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM synthesis WHERE name = %s", (directory,))
        result = cur.fetchone()
        return result[0] if result else None
    finally:
        cur.close()
        conn.close()


def extend_lock(directory: str, worker_id: str) -> bool:
    """Extend lock for another 5 minutes."""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE synthesis
            SET locked_at = NOW()
            WHERE name = %s AND locked_by = %s AND status = 'locked'
            RETURNING name
        """, (directory, worker_id))
        result = cur.fetchone()
        return result is not None
    finally:
        cur.close()
        conn.close()


def save_smiles_result(synthesis_id: int, image_filename: str, smiles: str,
                       smiles_confidence: float, error: str, duration_ms: int, worker_id: str):
    """Save SMILES result to database."""
    conn = get_db_connection()
    conn.autocommit = True
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
    finally:
        cur.close()
        conn.close()


def mark_completed(directory: str, worker_id: str, successful: int, failed: int, image_count: int):
    """Mark directory as completed in PostgreSQL."""
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
        """, (worker_id, successful, failed, image_count, directory))
    finally:
        cur.close()
        conn.close()


def mark_failed(directory: str, worker_id: str):
    """Mark directory as failed in PostgreSQL."""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE synthesis
            SET status = 'failed',
                worker_id = %s
            WHERE name = %s
        """, (worker_id, directory))
    finally:
        cur.close()
        conn.close()


def main():
    if len(sys.argv) < 3:
        print("Usage: python worker.py <directory> <worker_id>")
        sys.exit(1)

    directory = sys.argv[1]
    worker_id = sys.argv[2]

    # Get synthesis_id
    synthesis_id = get_synthesis_id(directory)
    if not synthesis_id:
        log_to_db(worker_id, directory, 'ERROR', f'Synthesis not found: {directory}')
        print(f"[{worker_id}] Synthesis not found: {directory}")
        sys.exit(1)

    # Lock already acquired by blob_processor, just extend it
    if not extend_lock(directory, worker_id):
        log_to_db(worker_id, directory, 'ERROR', 'Lock not found or expired')
        print(f"[{worker_id}] Lock not found for {directory}")
        sys.exit(1)

    print(f"[{worker_id}] Processing: {directory} (synthesis_id={synthesis_id})")

    # Connect to blob storage
    blob_service = BlobServiceClient.from_connection_string(BLOB_CONNECTION_STRING)
    container = blob_service.get_container_client(BLOB_CONTAINER)

    try:
        # Download images to temp directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            print(f"[{worker_id}] Downloading images...")
            images = []
            prefix = f"{directory}/output/"
            for blob in container.list_blobs(name_starts_with=prefix):
                if blob.name.lower().endswith(('.png', '.jpg', '.jpeg')):
                    local_file = temp_path / Path(blob.name).name
                    with open(local_file, 'wb') as f:
                        f.write(container.get_blob_client(blob.name).download_blob().readall())
                    images.append(local_file)

            if not images:
                print(f"[{worker_id}] No images found")
                mark_completed(directory, worker_id, 0, 0, 0)
                return

            print(f"[{worker_id}] Processing {len(images)} images...")

            # Import DECIMER only when needed
            from DECIMER import predict_SMILES

            successful = 0
            failed = 0

            for i, img in enumerate(sorted(images)):
                start_time = time.time()

                try:
                    # Get SMILES with confidence scores
                    result = predict_SMILES(str(img), confidence=True)
                    duration_ms = int((time.time() - start_time) * 1000)

                    # Parse result: (smiles_string, [(char, confidence), ...])
                    smiles = result[0]
                    char_confidences = result[1]

                    # Calculate average confidence
                    if char_confidences:
                        avg_confidence = sum(float(c[1]) for c in char_confidences) / len(char_confidences)
                    else:
                        avg_confidence = None

                    # Save to database
                    save_smiles_result(
                        synthesis_id=synthesis_id,
                        image_filename=img.name,
                        smiles=smiles,
                        smiles_confidence=avg_confidence,
                        error=None,
                        duration_ms=duration_ms,
                        worker_id=worker_id
                    )
                    successful += 1

                except Exception as e:
                    duration_ms = int((time.time() - start_time) * 1000)

                    # Save error to database
                    save_smiles_result(
                        synthesis_id=synthesis_id,
                        image_filename=img.name,
                        smiles=None,
                        smiles_confidence=None,
                        error=str(e),
                        duration_ms=duration_ms,
                        worker_id=worker_id
                    )
                    failed += 1

                # Extend lock after every image
                extend_lock(directory, worker_id)

                # Progress every 10 images
                if (i + 1) % 10 == 0:
                    print(f"[{worker_id}] Progress: {i+1}/{len(images)}")

            # Mark completed in database
            mark_completed(directory, worker_id, successful, failed, len(images))
            print(f"[{worker_id}] Done: {successful}/{len(images)} successful")

    except Exception as e:
        tb = traceback.format_exc()
        log_to_db(worker_id, directory, 'ERROR', str(e), tb)
        print(f"[{worker_id}] Error: {e}")
        mark_failed(directory, worker_id)
        sys.exit(1)


if __name__ == '__main__':
    main()
