#!/usr/bin/env python3
"""
DECIMER Blob Processor - Using PostgreSQL for coordination

Monitors CPU/memory usage and spawns workers when resources available.
Workers coordinate via PostgreSQL for atomic locking.
"""

import os
import sys
import subprocess
import socket
import psutil

import psycopg2

# Import config
from db_config import DB_CONFIG

VM_ID = socket.gethostname()


def log_to_db(level: str, message: str):
    """Log message to database."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO logs (worker_id, directory, level, message)
            VALUES (%s, %s, %s, %s)
        """, (VM_ID, 'processor', level, message))
        cur.close()
        conn.close()
    except:
        pass  # Don't fail if logging fails

# Configuration - Keep below 80% usage
CPU_THRESHOLD = 60
MEMORY_THRESHOLD = 60
CHECK_INTERVAL = 10
# Each worker uses ~2 cores when processing. To stay under 80%: max_workers = (cores * 0.8) / 2
import multiprocessing
MAX_WORKERS = max(1, int(multiprocessing.cpu_count() * 0.8 / 2))


def get_db_connection():
    """Get PostgreSQL connection."""
    return psycopg2.connect(**DB_CONFIG)


def find_and_lock_available(worker_id: str) -> str | None:
    """Find and atomically lock an available synthesis directory."""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()

    try:
        # Atomic: find pending or expired-lock, lock it, return name
        cur.execute("""
            UPDATE synthesis
            SET status = 'locked',
                locked_by = %s,
                locked_at = NOW()
            WHERE name = (
                SELECT name FROM synthesis
                WHERE status = 'pending'
                   OR (status = 'locked' AND locked_at < NOW() - INTERVAL '5 minutes')
                ORDER BY name
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING name
        """, (worker_id,))

        result = cur.fetchone()
        return result[0] if result else None
    finally:
        cur.close()
        conn.close()


def get_stats() -> dict:
    """Get processing statistics from PostgreSQL."""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'locked') as locked,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM synthesis
        """)
        row = cur.fetchone()
        return {
            'total': row[0],
            'completed': row[1],
            'pending': row[2],
            'locked': row[3],
            'failed': row[4],
            'remaining': row[2] + row[3]  # pending + locked
        }
    finally:
        cur.close()
        conn.close()


def get_resources() -> tuple[float, float]:
    """Get average CPU and memory usage over 5 seconds."""
    cpu_samples = []
    mem_samples = []
    for _ in range(5):
        cpu_samples.append(psutil.cpu_percent(interval=1))
        mem_samples.append(psutil.virtual_memory().percent)
    return sum(cpu_samples) / 5, sum(mem_samples) / 5


def can_spawn() -> bool:
    """Check if resources allow spawning."""
    cpu, mem = get_resources()
    return cpu < CPU_THRESHOLD and mem < MEMORY_THRESHOLD


def preload_decimer_models():
    """Pre-load DECIMER models to avoid race conditions when workers spawn."""
    log_to_db('INFO', "Pre-loading DECIMER models...")
    try:
        from DECIMER import predict_SMILES
        log_to_db('INFO', "DECIMER models loaded successfully")
    except Exception as e:
        log_to_db('ERROR', f"Failed to load DECIMER models: {e}")
        raise


def main():
    # Pre-load models BEFORE spawning any workers
    preload_decimer_models()

    stats = get_stats()
    log_to_db('INFO', f"Starting: {stats['total']} total, {stats['completed']} done, {stats['pending']} pending (max {MAX_WORKERS} workers)")

    # Track running processes
    processes = {}  # pid -> (directory, process)
    worker_num = 0

    import time

    while True:
        try:
            # Check completed processes
            for pid in list(processes.keys()):
                directory, proc = processes[pid]
                if proc.poll() is not None:
                    if proc.returncode == 0:
                        log_to_db('INFO', f"Completed: {directory}")
                    else:
                        log_to_db('ERROR', f"Failed: {directory} (exit code {proc.returncode})")
                    del processes[pid]

            # Spawn new worker if resources allow AND under max workers
            if can_spawn() and len(processes) < MAX_WORKERS:
                worker_id = f"{VM_ID}-{worker_num}"

                # Atomically find and lock a directory
                directory = find_and_lock_available(worker_id)

                if directory:
                    worker_num += 1

                    # Spawn separate process
                    script_dir = os.path.dirname(os.path.abspath(__file__))
                    proc = subprocess.Popen(
                        [sys.executable, '-u', 'worker.py', directory, worker_id],
                        cwd=script_dir,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT
                    )
                    processes[proc.pid] = (directory, proc)
                    log_to_db('INFO', f"Spawned {worker_id} for {directory}")

            # Status update
            cpu, mem = get_resources()
            stats = get_stats()
            log_to_db('INFO', f"Status: {stats['completed']}/{stats['total']} done | {len(processes)} workers | CPU: {cpu:.0f}% | MEM: {mem:.0f}%")

            # Check if all done
            if stats['remaining'] == 0 and len(processes) == 0:
                log_to_db('INFO', "All directories processed!")
                break

        except Exception as e:
            log_to_db('ERROR', f"Loop error (retrying): {e}")

        time.sleep(CHECK_INTERVAL)


if __name__ == '__main__':
    main()
