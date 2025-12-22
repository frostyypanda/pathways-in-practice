#!/usr/bin/env python3
"""
Batch Collect - Download results from Gemini Batch API and store in DB.

Usage:
    # Check status
    python batch_collect.py --job-name batches/xxx --status-only

    # Download and import (default)
    python batch_collect.py --job-name batches/xxx

    # Download only (save to file)
    python batch_collect.py --job-name batches/xxx --download-only

    # Import from saved file
    python batch_collect.py --from-file batch7_results.jsonl
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from google import genai

# Load environment variables
load_dotenv()

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
    )


def prefetch_all_smiles(conn, synthesis_ids: list) -> dict:
    """Prefetch ALL smiles data for given synthesis IDs in ONE query.

    Returns dict: {(synthesis_id, base_filename): {reactant: {...}, reagent: {...}, product: {...}}}
    """
    if not synthesis_ids:
        return {}

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT synthesis_id, image_filename, smiles, smiles_confidence
            FROM smiles_results
            WHERE synthesis_id = ANY(%s)
            """,
            (synthesis_ids,),
        )
        rows = cur.fetchall()

    # Build lookup dict
    cache = {}
    for synthesis_id, filename, smiles, confidence in rows:
        # Extract base_filename (remove _left/_middle/_right.png suffix)
        if filename.endswith("_left.png"):
            base = filename[:-9]
            part = "reactant"
        elif filename.endswith("_middle.png"):
            base = filename[:-11]
            part = "reagent"
        elif filename.endswith("_right.png"):
            base = filename[:-10]
            part = "product"
        else:
            continue

        key = (synthesis_id, base)
        if key not in cache:
            cache[key] = {
                "reactant": {"smiles": "", "confidence": 0},
                "reagent": {"smiles": "", "confidence": 0},
                "product": {"smiles": "", "confidence": 0},
            }
        cache[key][part] = {"smiles": smiles or "", "confidence": confidence or 0}

    return cache


def get_smiles_from_cache(cache: dict, synthesis_id: int, base_filename: str) -> dict:
    """Get SMILES from prefetched cache."""
    return cache.get((synthesis_id, base_filename), {
        "reactant": {"smiles": "", "confidence": 0},
        "reagent": {"smiles": "", "confidence": 0},
        "product": {"smiles": "", "confidence": 0},
    })


def parse_llm_response(content: str) -> dict:
    """Parse JSON from LLM response."""
    # Try to extract JSON from code block
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', content, re.DOTALL)
    if json_match:
        json_str = json_match.group(1).strip()
    else:
        json_str = content.strip()

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"  WARNING: Failed to parse JSON: {e}")
        return None


def store_result(conn, synthesis_id: int, base_filename: str, existing_smiles: dict,
                 parsed: dict, model: str):
    """Store step data in synthesis_steps table."""
    if not parsed:
        print(f"  Skipping {base_filename} - no parsed results")
        return False

    image_filename = f"{base_filename}.png"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO synthesis_steps (
                synthesis_id, image_filename,
                original_reactant_smiles, original_reagent_smiles, original_product_smiles,
                corrected_reactant_smiles, corrected_reagent_smiles, corrected_product_smiles,
                reagents, conditions, yield, reaction_type, notes,
                corrections_made, continuity,
                llm_model, llm_cost, tokens_used, processed_at
            ) VALUES (
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s
            )
            ON CONFLICT (synthesis_id, image_filename) DO UPDATE SET
                corrected_reactant_smiles = EXCLUDED.corrected_reactant_smiles,
                corrected_reagent_smiles = EXCLUDED.corrected_reagent_smiles,
                corrected_product_smiles = EXCLUDED.corrected_product_smiles,
                reagents = EXCLUDED.reagents,
                conditions = EXCLUDED.conditions,
                yield = EXCLUDED.yield,
                reaction_type = EXCLUDED.reaction_type,
                notes = EXCLUDED.notes,
                corrections_made = EXCLUDED.corrections_made,
                continuity = EXCLUDED.continuity,
                llm_model = EXCLUDED.llm_model,
                processed_at = EXCLUDED.processed_at
            """,
            (
                synthesis_id, image_filename,
                existing_smiles["reactant"]["smiles"],
                existing_smiles["reagent"]["smiles"],
                existing_smiles["product"]["smiles"],
                parsed.get("reactant_smiles", ""),
                parsed.get("reagent_smiles", ""),
                parsed.get("product_smiles", ""),
                parsed.get("reagents", ""),
                parsed.get("conditions", ""),
                parsed.get("yield", ""),
                parsed.get("reaction_type", ""),
                parsed.get("notes", ""),
                json.dumps(parsed.get("corrections_made", [])),
                json.dumps(parsed.get("continuity")) if parsed.get("continuity") else None,
                model,
                None,  # Cost not available from batch
                None,  # Tokens not available from batch
                datetime.now(),
            ),
        )

    return True


def _batch_insert(conn, rows: list):
    """Batch insert rows using executemany with ON CONFLICT handling."""
    if not rows:
        return

    with conn.cursor() as cur:
        # Use execute_values for better performance with PostgreSQL
        from psycopg2.extras import execute_values

        sql = """
            INSERT INTO synthesis_steps (
                synthesis_id, image_filename,
                original_reactant_smiles, original_reagent_smiles, original_product_smiles,
                corrected_reactant_smiles, corrected_reagent_smiles, corrected_product_smiles,
                reagents, conditions, yield, reaction_type, notes,
                corrections_made, continuity,
                llm_model, llm_cost, tokens_used, processed_at
            ) VALUES %s
            ON CONFLICT (synthesis_id, image_filename) DO UPDATE SET
                corrected_reactant_smiles = EXCLUDED.corrected_reactant_smiles,
                corrected_reagent_smiles = EXCLUDED.corrected_reagent_smiles,
                corrected_product_smiles = EXCLUDED.corrected_product_smiles,
                reagents = EXCLUDED.reagents,
                conditions = EXCLUDED.conditions,
                yield = EXCLUDED.yield,
                reaction_type = EXCLUDED.reaction_type,
                notes = EXCLUDED.notes,
                corrections_made = EXCLUDED.corrections_made,
                continuity = EXCLUDED.continuity,
                llm_model = EXCLUDED.llm_model,
                processed_at = EXCLUDED.processed_at
        """
        execute_values(cur, sql, rows)


def check_status(client, job_name: str) -> dict:
    """Check batch job status."""
    job = client.batches.get(name=job_name)
    return {
        "name": job.name,
        "state": job.state.name,
        "dest": getattr(job, 'dest', None),
    }


def download_results(client, job_name: str, output_file: str = None) -> str:
    """Download results from batch job to file. Returns output filename."""
    job = client.batches.get(name=job_name)
    dest_file = getattr(job, 'dest', None)

    if not dest_file:
        print("ERROR: No destination file found")
        return None

    print("\nDownloading results...")
    dest_file_name = dest_file.file_name if hasattr(dest_file, 'file_name') else str(dest_file)
    results_content = client.files.download(file=dest_file_name)

    # Determine output filename
    if not output_file:
        output_file = f"results_{job_name.split('/')[-1][:12]}.jsonl"

    output_path = Path(__file__).parent / output_file
    output_path.write_bytes(results_content)

    line_count = len(results_content.decode('utf-8').strip().split('\n'))
    print(f"Saved {line_count} results to {output_path}")
    return str(output_path)


def import_from_file(file_path: str):
    """Import results from a local JSONL file into the database."""
    print(f"Loading results from {file_path}...")

    with open(file_path, 'r') as f:
        results_text = f.read()

    results = []
    for line in results_text.strip().split('\n'):
        if line:
            results.append(json.loads(line))

    print(f"Loaded {len(results)} results")
    _import_results_to_db(results)


def _import_results_to_db(results: list):
    """Import parsed results into database."""
    conn = get_db_connection()

    try:
        # Extract all synthesis IDs from results for prefetch
        synthesis_ids = set()
        for result in results:
            key = result.get('key', '')
            parts = key.split('_', 1)
            if len(parts) == 2:
                synthesis_ids.add(int(parts[0]))

        # Prefetch ALL smiles in ONE query
        print(f"\nPrefetching SMILES for {len(synthesis_ids)} syntheses...")
        smiles_cache = prefetch_all_smiles(conn, list(synthesis_ids))
        print(f"Loaded {len(smiles_cache)} step records into cache")

        success_count = 0
        fail_count = 0
        batch_data = []  # Collect data for batch insert
        BATCH_SIZE = 500

        # Token tracking
        total_prompt_tokens = 0
        total_output_tokens = 0
        total_thinking_tokens = 0
        total_cached_tokens = 0
        total_cost = 0.0

        print("\nProcessing results...")
        for i, result in enumerate(results):
            key = result.get('key', '')
            response = result.get('response', {})

            # Parse key: "3829_sequence_01"
            parts = key.split('_', 1)
            if len(parts) != 2:
                print(f"  Invalid key format: {key}")
                fail_count += 1
                continue

            synthesis_id = int(parts[0])
            base_filename = parts[1]

            # Get response content
            candidates = response.get('candidates', [])
            if not candidates:
                print(f"  No candidates for {key}")
                fail_count += 1
                continue

            content_parts = candidates[0].get('content', {}).get('parts', [])
            if not content_parts:
                print(f"  No content for {key}")
                fail_count += 1
                continue

            text_content = content_parts[0].get('text', '')

            # Parse LLM response
            parsed = parse_llm_response(text_content)
            if not parsed:
                print(f"  Skipping {base_filename} - no parsed results")
                fail_count += 1
                continue

            # Extract token usage from response
            usage = response.get('usageMetadata', {})
            tokens_used = {
                "prompt": usage.get('promptTokenCount', 0),
                "output": usage.get('candidatesTokenCount', 0),
                "thinking": usage.get('thoughtsTokenCount', 0),
                "cached": usage.get('cachedContentTokenCount', 0),
                "total": usage.get('totalTokenCount', 0),
            }

            # Calculate cost (Gemini 3 Flash batch pricing: 50% discount)
            # Input: $0.25/1M, Output: $1.50/1M (includes thinking)
            input_cost = (tokens_used["prompt"] / 1_000_000) * 0.25
            output_cost = ((tokens_used["output"] + tokens_used["thinking"]) / 1_000_000) * 1.50
            llm_cost = input_cost + output_cost

            # Accumulate totals
            total_prompt_tokens += tokens_used["prompt"]
            total_output_tokens += tokens_used["output"]
            total_thinking_tokens += tokens_used["thinking"]
            total_cached_tokens += tokens_used["cached"]
            total_cost += llm_cost

            # Get original SMILES from prefetched cache (O(1) lookup)
            existing_smiles = get_smiles_from_cache(smiles_cache, synthesis_id, base_filename)

            # Prepare row for batch insert
            image_filename = f"{base_filename}.png"
            row = (
                synthesis_id, image_filename,
                existing_smiles["reactant"]["smiles"],
                existing_smiles["reagent"]["smiles"],
                existing_smiles["product"]["smiles"],
                parsed.get("reactant_smiles", ""),
                parsed.get("reagent_smiles", ""),
                parsed.get("product_smiles", ""),
                parsed.get("reagents", ""),
                parsed.get("conditions", ""),
                parsed.get("yield", ""),
                parsed.get("reaction_type", ""),
                parsed.get("notes", ""),
                json.dumps(parsed.get("corrections_made", [])),
                json.dumps(parsed.get("continuity")) if parsed.get("continuity") else None,
                "gemini-3-flash-batch",
                llm_cost,
                tokens_used["total"],
                datetime.now(),
            )
            batch_data.append(row)
            success_count += 1

            # Insert batch when full
            if len(batch_data) >= BATCH_SIZE:
                _batch_insert(conn, batch_data)
                progress = (i + 1) / len(results) * 100
                print(f"  Inserted {len(batch_data)} rows ({progress:.1f}% complete)")
                batch_data = []

        # Insert remaining rows
        if batch_data:
            _batch_insert(conn, batch_data)
            print(f"  Inserted final {len(batch_data)} rows (100% complete)")

        conn.commit()

        print(f"\n{'='*60}")
        print(f"RESULTS IMPORTED")
        print(f"{'='*60}")
        print(f"Success: {success_count}")
        print(f"Failed: {fail_count}")
        print(f"Total: {len(results)}")
        print(f"\n{'='*60}")
        print(f"TOKEN USAGE & COST")
        print(f"{'='*60}")
        print(f"Prompt tokens:   {total_prompt_tokens:,}")
        print(f"Output tokens:   {total_output_tokens:,}")
        print(f"Thinking tokens: {total_thinking_tokens:,}")
        print(f"Cached tokens:   {total_cached_tokens:,}")
        print(f"{'='*60}")
        print(f"Total cost:      ${total_cost:.4f}")

    finally:
        conn.close()


def collect_results(job_name: str, status_only: bool = False, download_only: bool = False, output_file: str = None):
    """Download results from batch job and optionally import to DB."""
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    print(f"Checking job: {job_name}")
    status = check_status(client, job_name)
    print(f"Status: {status['state']}")

    if status_only:
        return

    if status['state'] != 'JOB_STATE_SUCCEEDED':
        if status['state'] == 'JOB_STATE_FAILED':
            print("ERROR: Job failed!")
        else:
            print(f"Job not complete yet. Current state: {status['state']}")
        return

    # Download to file
    saved_file = download_results(client, job_name, output_file)
    if not saved_file:
        return

    if download_only:
        print("\nDownload complete. Run with --from-file to import.")
        return

    # Import to DB
    import_from_file(saved_file)

    # Update batch jobs tracking
    if BATCH_JOBS_FILE.exists():
        jobs = json.loads(BATCH_JOBS_FILE.read_text())
        if job_name in jobs:
            jobs[job_name]['status'] = 'collected'
            jobs[job_name]['collected_at'] = datetime.now().isoformat()
            BATCH_JOBS_FILE.write_text(json.dumps(jobs, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Collect batch results from Gemini API")
    parser.add_argument("--job-name", help="Batch job name (e.g., batches/xxx)")
    parser.add_argument("--status-only", action="store_true", help="Only check status, don't collect")
    parser.add_argument("--download-only", action="store_true", help="Download to file only, don't import")
    parser.add_argument("--output-file", help="Output filename for downloaded results")
    parser.add_argument("--from-file", help="Import from local JSONL file instead of downloading")

    args = parser.parse_args()

    if args.from_file:
        import_from_file(args.from_file)
    elif args.job_name:
        collect_results(
            job_name=args.job_name,
            status_only=args.status_only,
            download_only=args.download_only,
            output_file=args.output_file,
        )
    else:
        parser.print_help()
        print("\nError: Must specify either --job-name or --from-file")


if __name__ == "__main__":
    main()
