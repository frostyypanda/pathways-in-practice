#!/usr/bin/env python3
"""
Export synthesis data from database to OpenSynth JSON format.

Usage:
    python export_json.py --all                    # Export all syntheses with steps
    python export_json.py --synthesis-id 3829      # Export single synthesis
    python export_json.py --all --update-index     # Export all and update index.json
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


def get_db_connection():
    """Connect to PostgreSQL database."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        sslmode=os.getenv("DB_SSLMODE", "require"),
    )


def parse_synthesis_name(name: str) -> dict:
    """
    Parse synthesis name to extract metadata.

    Format: "Molecule Name (Author Year)"
    Examples:
        "Bilain B (Strand 2024)" -> {"molecule_name": "Bilain B", "author": "Strand", "year": 2024}
    """
    match = re.match(r'^(.+?)\s*\(([^)]+)\s+(\d{4})\)$', name)
    if match:
        return {
            "molecule_name": match.group(1).strip(),
            "author": match.group(2).strip(),
            "year": int(match.group(3)),
        }
    return {
        "molecule_name": name,
        "author": "Unknown",
        "year": 2024,
    }


def parse_filename(filename: str) -> tuple:
    """Parse image filename to extract step and substep numbers."""
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


def fetch_all_syntheses_with_steps(conn) -> list:
    """Fetch all syntheses that have steps in synthesis_steps table."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT s.id, s.name
            FROM synthesis s
            INNER JOIN synthesis_steps ss ON s.id = ss.synthesis_id
            ORDER BY s.name
        """)
        return [{"id": row[0], "name": row[1]} for row in cur.fetchall()]


def fetch_synthesis_steps(conn, synthesis_id: int) -> list:
    """Fetch all steps for a synthesis from database."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT image_filename,
                   corrected_reactant_smiles, corrected_reagent_smiles, corrected_product_smiles,
                   reagents, conditions, yield, reaction_type, notes
            FROM synthesis_steps
            WHERE synthesis_id = %s
            ORDER BY image_filename
        """, (synthesis_id,))
        columns = [desc[0] for desc in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]


def organize_steps(rows: list) -> list:
    """Organize database rows into hierarchical step structure."""
    steps_data = defaultdict(lambda: {"main": None, "substeps": []})

    for row in rows:
        step_num, sub_num = parse_filename(row["image_filename"])
        if step_num is None:
            continue

        if sub_num is None:
            steps_data[step_num]["main"] = build_step(row, str(step_num))
        else:
            substep = build_step(row, f"{step_num}.{sub_num}")
            steps_data[step_num]["substeps"].append((sub_num, substep))

    sequence = []
    for step_num in sorted(steps_data.keys()):
        data = steps_data[step_num]
        main_step = data["main"]
        if main_step is None:
            continue
        if data["substeps"]:
            sorted_substeps = sorted(data["substeps"], key=lambda x: x[0])
            main_step["substeps"] = [s[1] for s in sorted_substeps]
        sequence.append(main_step)

    return sequence


def generate_file_slug(molecule_name: str, author: str, year: int) -> str:
    """Generate a file-safe slug from metadata."""
    name_slug = re.sub(r'[^a-z0-9]+', '_', molecule_name.lower()).strip('_')
    author_slug = re.sub(r'[^a-z0-9]+', '_', author.lower()).strip('_')
    return f"{name_slug}_{author_slug}_{year}"


def generate_json(synthesis_id: int, synthesis_name: str, output_dir: Path, conn) -> dict:
    """Generate JSON file for a synthesis."""
    meta = parse_synthesis_name(synthesis_name)
    file_slug = generate_file_slug(meta["molecule_name"], meta["author"], meta["year"])
    id_slug = file_slug.replace("_", "-")

    print(f"  Exporting: {meta['molecule_name']} ({meta['author']} {meta['year']})")

    rows = fetch_synthesis_steps(conn, synthesis_id)
    if not rows:
        print(f"    Warning: No steps found")
        return None

    sequence = organize_steps(rows)
    if not sequence:
        print(f"    Warning: No valid steps")
        return None

    substep_count = sum(len(s.get("substeps", [])) for s in sequence)
    print(f"    {len(sequence)} steps" + (f" + {substep_count} substeps" if substep_count else ""))

    json_data = {
        "$schema": "../schema.json",
        "meta": {
            "id": id_slug,
            "molecule_name": meta["molecule_name"],
            "class": "Natural Product",
            "author": meta["author"],
            "year": meta["year"],
        },
        "sequence": sequence,
    }

    output_file = output_dir / f"{file_slug}.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=4, ensure_ascii=False)

    return {
        "id": id_slug,
        "molecule_name": meta["molecule_name"],
        "class": "Natural Product",
        "author": meta["author"],
        "year": meta["year"],
        "path": f"/data/imported/{file_slug}.json",
        "step_count": len(sequence),
    }


def update_index_json(new_entries: list, index_path: Path):
    """Update index.json with new entries, replacing imported ones."""
    if index_path.exists():
        with open(index_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
    else:
        existing = []

    kept = [e for e in existing if not e.get("path", "").startswith("/data/imported/")]
    all_entries = kept + new_entries
    all_entries.sort(key=lambda x: x.get("molecule_name", "").lower())

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(all_entries, f, indent=4, ensure_ascii=False)

    print(f"\nUpdated {index_path}")
    print(f"  Kept {len(kept)} existing entries")
    print(f"  Added {len(new_entries)} imported entries")
    print(f"  Total: {len(all_entries)} entries")


def main():
    parser = argparse.ArgumentParser(description="Export synthesis data to JSON")
    parser.add_argument("--synthesis-id", type=int, help="Single synthesis ID to export")
    parser.add_argument("--all", action="store_true", help="Export all syntheses with steps")
    parser.add_argument("--update-index", action="store_true", help="Update index.json")
    parser.add_argument("--output-dir", type=Path,
        default=Path(__file__).parent.parent / "public" / "data" / "imported",
        help="Output directory for JSON files")

    args = parser.parse_args()

    if not args.all and not args.synthesis_id:
        parser.print_help()
        return

    print(f"Output directory: {args.output_dir}")
    conn = get_db_connection()

    try:
        if args.all:
            syntheses = fetch_all_syntheses_with_steps(conn)
            print(f"Found {len(syntheses)} syntheses with steps\n")
        else:
            with conn.cursor() as cur:
                cur.execute("SELECT id, name FROM synthesis WHERE id = %s", (args.synthesis_id,))
                row = cur.fetchone()
                if row:
                    syntheses = [{"id": row[0], "name": row[1]}]
                else:
                    print(f"Synthesis {args.synthesis_id} not found")
                    return

        index_entries = []
        for i, synth in enumerate(syntheses, 1):
            print(f"[{i}/{len(syntheses)}]", end="")
            entry = generate_json(synth["id"], synth["name"], args.output_dir, conn)
            if entry:
                index_entries.append(entry)

        print(f"\n{'='*60}")
        print(f"Exported {len(index_entries)} syntheses")

        if args.update_index:
            index_path = args.output_dir.parent / "index.json"
            update_index_json(index_entries, index_path)
        else:
            print("\nRun with --update-index to automatically update index.json")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
