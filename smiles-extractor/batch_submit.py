#!/usr/bin/env python3
"""
Batch Submit - Submit SMILES extraction jobs to Gemini Batch API.

Usage:
    # Build batch using ID range (RECOMMENDED - stable, won't shift)
    python batch_submit.py --from-id 5856 --to-id 6337 --build-only
    # Creates: batch_5856-6337.jsonl

    # List remaining batches with ID ranges
    python batch_submit.py --list-batches

    # Submit specific syntheses
    python batch_submit.py --synthesis-ids 3829,3842,3867,3869

    # Build only (don't upload)
    python batch_submit.py --from-id 5856 --to-id 6337 --build-only

    # Submit pre-built file
    python submit_file.py batch_5856-6337.jsonl

    # Dry run
    python batch_submit.py --from-id 5856 --to-id 6337 --dry-run

Note: --batch-num uses a sliding window that shifts after imports.
      Prefer --from-id/--to-id for predictable behavior.
"""

import argparse
import base64
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from google import genai

# Load environment variables
load_dotenv()

# Default base path for images (WSL path)
DEFAULT_BASE_PATH = "/mnt/d/chemistry-scraped"

# Batch job tracking file
BATCH_JOBS_FILE = Path(__file__).parent / "batch_jobs.json"


def get_db_connection():
    """Connect to PostgreSQL database."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        sslmode=os.getenv("DB_SSLMODE", "require"),
        connect_timeout=10,
    )


def get_unprocessed_synthesis_ids() -> list:
    """Get synthesis IDs that are ready for batch processing.

    Criteria:
    1. status = 'completed' (not failed)
    2. Has at least one image (exists in smiles_results)
    3. Not already processed (not in synthesis_steps)
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT s.id
                FROM synthesis s
                WHERE s.status = 'completed'
                  AND s.id NOT IN (SELECT DISTINCT synthesis_id FROM synthesis_steps)
                  AND s.id IN (SELECT DISTINCT synthesis_id FROM smiles_results)
                ORDER BY s.id
            ''')
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def get_batch_synthesis_ids(batch_num: int, batch_size: int) -> list:
    """Get synthesis IDs for a specific batch number."""
    all_ids = get_unprocessed_synthesis_ids()
    start = (batch_num - 1) * batch_size
    end = start + batch_size
    return all_ids[start:end]


def get_step_count_for_synthesis(conn, synthesis_id: int) -> int:
    """Get number of steps for a synthesis."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(DISTINCT regexp_replace(image_filename, '_(left|middle|right)\\.png$', ''))
            FROM smiles_results
            WHERE synthesis_id = %s
            """,
            (synthesis_id,),
        )
        return cur.fetchone()[0]


def list_batches(batch_size: int):
    """Show batch plan for all unprocessed syntheses."""
    all_ids = get_unprocessed_synthesis_ids()
    total_syntheses = len(all_ids)
    num_batches = (total_syntheses + batch_size - 1) // batch_size

    # Get step counts for all syntheses in one query
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT synthesis_id, COUNT(DISTINCT regexp_replace(image_filename, '_(left|middle|right)\\.png$', ''))
                FROM smiles_results
                WHERE synthesis_id = ANY(%s)
                GROUP BY synthesis_id
            ''', (all_ids,))
            step_counts = {row[0]: row[1] for row in cur.fetchall()}
    finally:
        conn.close()

    # Calculate total steps
    total_steps = sum(step_counts.get(sid, 0) for sid in all_ids)

    print(f"Total unprocessed syntheses: {total_syntheses}")
    print(f"Total steps to process: {total_steps}")
    print(f"Batch size: {batch_size}")
    print(f"Total batches: {num_batches}")
    print(f"Avg steps per synthesis: {total_steps / total_syntheses:.1f}")
    print()

    print("\nBatches:")
    for batch_num in range(1, num_batches + 1):
        start = (batch_num - 1) * batch_size
        end = min(start + batch_size, total_syntheses)
        batch_ids = all_ids[start:end]

        # Count steps for this batch
        batch_steps = sum(step_counts.get(sid, 0) for sid in batch_ids)

        print(f"  {batch_ids[0]}-{batch_ids[-1]}: {len(batch_ids):3d} syntheses, ~{batch_steps} steps")

    print("\nCommands to build each batch:")
    for batch_num in range(1, num_batches + 1):
        start = (batch_num - 1) * batch_size
        end = min(start + batch_size, total_syntheses)
        batch_ids = all_ids[start:end]
        print(f"  python batch_submit.py --from-id {batch_ids[0]} --to-id {batch_ids[-1]} --build-only")


def get_synthesis_name(conn, synthesis_id: int) -> str:
    """Get synthesis directory name from synthesis table."""
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM synthesis WHERE id = %s", (synthesis_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Synthesis ID {synthesis_id} not found")
        return row[0]


def get_steps_for_synthesis(conn, synthesis_id: int) -> list:
    """Get all unique step base_filenames for a synthesis."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT
                regexp_replace(image_filename, '_(left|middle|right)\\.png$', '') as base_filename
            FROM smiles_results
            WHERE synthesis_id = %s
            ORDER BY base_filename
            """,
            (synthesis_id,),
        )
        rows = cur.fetchall()
    return [row[0] for row in rows]


def fetch_smiles_for_image(conn, synthesis_id: int, base_filename: str) -> dict:
    """Fetch 3 SMILES records from DB for a given image."""
    filenames = [
        f"{base_filename}_left.png",
        f"{base_filename}_middle.png",
        f"{base_filename}_right.png",
    ]

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT image_filename, smiles, smiles_confidence
            FROM smiles_results
            WHERE synthesis_id = %s AND image_filename IN %s
            """,
            (synthesis_id, tuple(filenames)),
        )
        rows = cur.fetchall()

    result = {
        "reactant": {"smiles": "", "confidence": 0},
        "reagent": {"smiles": "", "confidence": 0},
        "product": {"smiles": "", "confidence": 0},
    }

    for filename, smiles, confidence in rows:
        if filename.endswith("_left.png"):
            result["reactant"] = {"smiles": smiles or "", "confidence": confidence or 0}
        elif filename.endswith("_middle.png"):
            result["reagent"] = {"smiles": smiles or "", "confidence": confidence or 0}
        elif filename.endswith("_right.png"):
            result["product"] = {"smiles": smiles or "", "confidence": confidence or 0}

    return result


def load_prompt() -> str:
    """Load the SMILES validation prompt from markdown file."""
    script_dir = Path(__file__).parent
    prompt_path = script_dir.parent / "docs" / "SINGLE_STEP_SMILES_VALIDATION_PROMPT.md"

    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

    return prompt_path.read_text(encoding="utf-8")


def encode_image(image_path: Path) -> str:
    """Encode image to base64 string."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def build_user_message(existing_smiles: dict) -> str:
    """Build the user message text."""
    smiles_json = json.dumps({
        "reactant": existing_smiles["reactant"]["smiles"],
        "reagent": existing_smiles["reagent"]["smiles"],
        "product": existing_smiles["product"]["smiles"],
    }, indent=2)

    return f"""Here are the current SMILES to validate:

```json
{smiles_json}
```

Confidence scores:
- Reactant: {existing_smiles['reactant']['confidence']:.2f}
- Reagent: {existing_smiles['reagent']['confidence']:.2f}
- Product: {existing_smiles['product']['confidence']:.2f}

Please validate these against the screenshot and provide corrected SMILES."""


def build_batch_requests(synthesis_ids: list, base_path: str, prompt: str) -> list:
    """Build all batch requests for the given syntheses."""
    conn = get_db_connection()
    requests = []

    try:
        for synthesis_id in synthesis_ids:
            synthesis_name = get_synthesis_name(conn, synthesis_id)
            steps = get_steps_for_synthesis(conn, synthesis_id)

            print(f"\n{synthesis_name} (ID: {synthesis_id}): {len(steps)} steps")

            for base_filename in steps:
                image_path = Path(base_path) / synthesis_name / f"{base_filename}.png"

                if not image_path.exists():
                    print(f"  WARNING: Image not found: {image_path}")
                    continue

                # Fetch existing SMILES
                existing_smiles = fetch_smiles_for_image(conn, synthesis_id, base_filename)

                # Build request key (used to match results later)
                key = f"{synthesis_id}_{base_filename}"

                # Build request
                image_base64 = encode_image(image_path)
                user_message = build_user_message(existing_smiles)

                request = {
                    "key": key,
                    "request": {
                        "contents": [{
                            "parts": [
                                {"inline_data": {"mime_type": "image/png", "data": image_base64}},
                                {"text": user_message}
                            ]
                        }],
                        "system_instruction": {"parts": [{"text": prompt}]}
                    }
                }

                requests.append(request)

    finally:
        conn.close()

    return requests


def save_batch_job(job_name: str, synthesis_ids: list, request_count: int):
    """Save batch job info for later collection."""
    jobs = {}
    if BATCH_JOBS_FILE.exists():
        jobs = json.loads(BATCH_JOBS_FILE.read_text())

    jobs[job_name] = {
        "synthesis_ids": synthesis_ids,
        "request_count": request_count,
        "submitted_at": datetime.now().isoformat(),
        "status": "submitted"
    }

    BATCH_JOBS_FILE.write_text(json.dumps(jobs, indent=2))
    print(f"\nSaved job info to {BATCH_JOBS_FILE}")


def submit_batch(synthesis_ids: list, base_path: str, dry_run: bool = False, batch_num: int = None,
                 build_only: bool = False, output_file: str = None):
    """Submit batch job to Gemini API."""

    # Load prompt
    prompt = load_prompt()
    print(f"Loaded prompt: {len(prompt)} characters")

    # Build all requests
    print("\nBuilding batch requests...")
    requests = build_batch_requests(synthesis_ids, base_path, prompt)
    print(f"\nTotal requests: {len(requests)}")

    if dry_run:
        print("\n[DRY RUN] Would submit the following:")
        print(f"  - {len(requests)} requests")
        print(f"  - Synthesis IDs: {synthesis_ids}")
        print(f"\nFirst request key: {requests[0]['key']}")
        return

    # Write JSONL file
    if output_file:
        jsonl_path = Path(__file__).parent / output_file
    elif synthesis_ids:
        # Auto-name based on ID range
        min_id = min(synthesis_ids)
        max_id = max(synthesis_ids)
        jsonl_path = Path(__file__).parent / f"batch_{min_id}-{max_id}.jsonl"
    else:
        jsonl_path = Path(__file__).parent / "batch_requests.jsonl"

    with open(jsonl_path, "w") as f:
        for req in requests:
            f.write(json.dumps(req) + "\n")
    print(f"\nWrote {len(requests)} requests to {jsonl_path}")
    print(f"File size: {jsonl_path.stat().st_size / 1024 / 1024:.2f} MB")

    if build_only:
        print("\n[BUILD ONLY] File ready for later upload")
        return

    # Initialize Gemini client
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    # Upload file
    print("\nUploading to Gemini Files API...")
    uploaded_file = client.files.upload(file=str(jsonl_path), config={"mime_type": "application/jsonl"})
    print(f"Uploaded: {uploaded_file.name}")

    # Submit batch job
    print("\nSubmitting batch job...")
    display_name = f"smiles-batch{batch_num}-{datetime.now().strftime('%Y%m%d-%H%M%S')}" if batch_num else f"smiles-extraction-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    batch_job = client.batches.create(
        model="gemini-2.5-flash",
        src=uploaded_file.name,
        config={"display_name": display_name}
    )

    print(f"\n{'='*60}")
    print(f"BATCH JOB SUBMITTED")
    print(f"{'='*60}")
    print(f"Job name: {batch_job.name}")
    print(f"Requests: {len(requests)}")
    print(f"Status: {batch_job.state.name}")
    print(f"\nRun this tomorrow to collect results:")
    print(f"  python batch_collect.py --job-name {batch_job.name}")

    # Save job info
    save_batch_job(batch_job.name, synthesis_ids, len(requests))


def main():
    parser = argparse.ArgumentParser(description="Submit batch job to Gemini API")
    parser.add_argument(
        "--synthesis-ids",
        help="Comma-separated synthesis IDs (e.g., 3829,3842,3867,3869)"
    )
    parser.add_argument(
        "--batch-num",
        type=int,
        help="Batch number to submit (1-indexed)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=400,
        help="Number of syntheses per batch (default: 400)"
    )
    parser.add_argument(
        "--list-batches",
        action="store_true",
        help="Show batch plan without submitting"
    )
    parser.add_argument(
        "--from-id",
        type=int,
        help="Start synthesis ID (inclusive)"
    )
    parser.add_argument(
        "--to-id",
        type=int,
        help="End synthesis ID (inclusive)"
    )
    parser.add_argument("--base-path", default=DEFAULT_BASE_PATH, help="Base path for images")
    parser.add_argument("--dry-run", action="store_true", help="Don't submit, just show what would be done")
    parser.add_argument("--build-only", action="store_true", help="Build JSONL file only, don't upload or submit")
    parser.add_argument("--output-file", help="Custom output filename for JSONL (default: batch_requests.jsonl)")

    args = parser.parse_args()

    # Handle --list-batches
    if args.list_batches:
        list_batches(args.batch_size)
        return

    # Determine synthesis IDs
    if args.from_id and args.to_id:
        # Get all unprocessed IDs in the range
        all_unprocessed = get_unprocessed_synthesis_ids()
        synthesis_ids = [sid for sid in all_unprocessed if args.from_id <= sid <= args.to_id]
        if not synthesis_ids:
            print(f"Error: No unprocessed syntheses in range {args.from_id}-{args.to_id}")
            return
        print(f"IDs {args.from_id}-{args.to_id}: {len(synthesis_ids)} syntheses")
    elif args.batch_num:
        synthesis_ids = get_batch_synthesis_ids(args.batch_num, args.batch_size)
        if not synthesis_ids:
            print(f"Error: Batch {args.batch_num} is empty or out of range")
            return
        print(f"Batch {args.batch_num}: {len(synthesis_ids)} syntheses")
    elif args.synthesis_ids:
        synthesis_ids = [int(x.strip()) for x in args.synthesis_ids.split(",")]
    else:
        parser.print_help()
        print("\nError: Must specify --from-id/--to-id, --synthesis-ids, --batch-num, or --list-batches")
        return

    submit_batch(
        synthesis_ids=synthesis_ids,
        base_path=args.base_path,
        dry_run=args.dry_run,
        batch_num=args.batch_num,
        build_only=args.build_only,
        output_file=args.output_file,
    )


if __name__ == "__main__":
    main()
