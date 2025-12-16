#!/usr/bin/env python3
"""
Export synthesis data from database to OpenSynth JSON format.

Usage:
    python export_json.py --synthesis-id 3829
    python export_json.py --all  # Export all 4 test syntheses
"""

import argparse
import json
import os
import re
from collections import defaultdict
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Synthesis metadata - will need to be expanded for full dataset
SYNTHESIS_METADATA = {
    3829: {
        "molecule_name": "Bilain B",
        "class": "Alkaloid",
        "author": "Strand",
        "year": 2024,
    },
    3842: {
        "molecule_name": "Biopyrrin A",
        "class": "Natural Product",
        "author": "Svenda",
        "year": 2024,
    },
    3867: {
        "molecule_name": "Bipolarolide A",
        "class": "Terpene",
        "author": "Lu",
        "year": 2025,
    },
    3869: {
        "molecule_name": "Bipolarolide B",
        "class": "Terpene",
        "author": "Lu",
        "year": 2025,
    },
}


def get_db_connection():
    """Connect to PostgreSQL database."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        sslmode=os.getenv("DB_SSLMODE", "require"),
    )


def parse_filename(filename: str) -> tuple:
    """
    Parse image filename to extract step and substep numbers.

    Examples:
        "sequence_05.png" → (5, None)
        "sequence_05_sub_01.png" → (5, 1)
    """
    match = re.match(r'sequence_(\d+)(?:_sub_(\d+))?\.png', filename)
    if match:
        step_num = int(match.group(1))
        sub_num = int(match.group(2)) if match.group(2) else None
        return step_num, sub_num
    return None, None


def build_step(row: dict, step_id: str) -> dict:
    """Build a step object from database row."""
    return {
        "step_id": step_id,
        "reaction_type": row.get("reaction_type") or "",
        "reagents": row.get("reagents") or "",
        "reagent_smiles": row.get("corrected_reagent_smiles") or "",
        "conditions": row.get("conditions") or "",
        "yield": row.get("yield") or "",
        "reactant_smiles": row.get("corrected_reactant_smiles") or "",
        "product_smiles": row.get("corrected_product_smiles") or "",
        "notes": row.get("notes") or "",
        "substeps": [],
    }


def fetch_synthesis_steps(conn, synthesis_id: int) -> list:
    """Fetch all steps for a synthesis from database."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT image_filename,
                   corrected_reactant_smiles, corrected_reagent_smiles, corrected_product_smiles,
                   reagents, conditions, yield, reaction_type, notes
            FROM synthesis_steps
            WHERE synthesis_id = %s
            ORDER BY image_filename
            """,
            (synthesis_id,),
        )
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    return rows


def organize_steps(rows: list) -> list:
    """
    Organize database rows into hierarchical step structure.
    Groups substeps under their main steps.
    """
    # Group steps by main step number
    steps_data = defaultdict(lambda: {"main": None, "substeps": []})

    for row in rows:
        step_num, sub_num = parse_filename(row["image_filename"])
        if step_num is None:
            print(f"  Warning: Could not parse filename: {row['image_filename']}")
            continue

        if sub_num is None:
            # Main step
            steps_data[step_num]["main"] = build_step(row, str(step_num))
        else:
            # Substep
            substep = build_step(row, f"{step_num}.{sub_num}")
            steps_data[step_num]["substeps"].append((sub_num, substep))

    # Build final sequence
    sequence = []
    for step_num in sorted(steps_data.keys()):
        data = steps_data[step_num]
        main_step = data["main"]

        if main_step is None:
            # Shouldn't happen based on our checks, but handle gracefully
            print(f"  Warning: Step {step_num} has substeps but no main step")
            continue

        # Sort and add substeps
        if data["substeps"]:
            sorted_substeps = sorted(data["substeps"], key=lambda x: x[0])
            main_step["substeps"] = [s[1] for s in sorted_substeps]

        sequence.append(main_step)

    return sequence


def generate_json(synthesis_id: int, output_dir: Path) -> dict:
    """Generate JSON file for a synthesis."""
    if synthesis_id not in SYNTHESIS_METADATA:
        print(f"Error: No metadata for synthesis {synthesis_id}")
        return None

    meta = SYNTHESIS_METADATA[synthesis_id]

    # Generate ID from metadata
    name_slug = meta["molecule_name"].lower().replace(" ", "_").replace("-", "_")
    synthesis_id_str = f"{name_slug}_{meta['author'].lower()}_{meta['year']}"

    print(f"\nExporting: {meta['molecule_name']} ({meta['author']} {meta['year']})")

    # Fetch and organize steps
    conn = get_db_connection()
    try:
        rows = fetch_synthesis_steps(conn, synthesis_id)
        print(f"  Found {len(rows)} database rows")

        sequence = organize_steps(rows)
        print(f"  Organized into {len(sequence)} main steps")

        # Count substeps
        substep_count = sum(len(s.get("substeps", [])) for s in sequence)
        if substep_count > 0:
            print(f"  With {substep_count} substeps")
    finally:
        conn.close()

    # Build JSON structure
    json_data = {
        "$schema": "../schema.json",
        "meta": {
            "id": synthesis_id_str.replace("_", "-"),
            "molecule_name": meta["molecule_name"],
            "class": meta["class"],
            "author": meta["author"],
            "year": meta["year"],
        },
        "sequence": sequence,
    }

    # Write JSON file
    output_file = output_dir / f"{synthesis_id_str}.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=4, ensure_ascii=False)

    print(f"  Written to: {output_file}")

    return {
        "id": synthesis_id_str.replace("_", "-"),
        "molecule_name": meta["molecule_name"],
        "class": meta["class"],
        "author": meta["author"],
        "year": meta["year"],
        "path": f"/data/imported/{synthesis_id_str}.json",
        "step_count": len(sequence),
    }


def main():
    parser = argparse.ArgumentParser(description="Export synthesis data to JSON")
    parser.add_argument("--synthesis-id", type=int, help="Single synthesis ID to export")
    parser.add_argument("--all", action="store_true", help="Export all test syntheses")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent.parent / "public" / "data" / "imported",
        help="Output directory for JSON files",
    )

    args = parser.parse_args()

    if args.all:
        synthesis_ids = list(SYNTHESIS_METADATA.keys())
    elif args.synthesis_id:
        synthesis_ids = [args.synthesis_id]
    else:
        parser.print_help()
        return

    print(f"Output directory: {args.output_dir}")

    index_entries = []
    for sid in synthesis_ids:
        entry = generate_json(sid, args.output_dir)
        if entry:
            index_entries.append(entry)

    # Print index.json entries for manual addition
    print("\n" + "=" * 60)
    print("Add these entries to public/data/index.json:")
    print("=" * 60)
    for entry in index_entries:
        print(json.dumps(entry, indent=4))
        print(",")


if __name__ == "__main__":
    main()
