#!/usr/bin/env python3
"""
SMILES Extractor & Store - Process all steps for a synthesis, validate with LLM, store in DB.

Usage:
    python extract_and_store.py --synthesis-id 3856
    python extract_and_store.py --synthesis-id 3856 --dry-run
"""

import argparse
import base64
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Default model for extraction
DEFAULT_MODEL = "gemini-2.5-flash"

# Model aliases to LiteLLM model IDs
MODELS = {
    "gemini-2.5-flash": "gemini/gemini-2.5-flash",
    "gemini-2.5-pro": "gemini/gemini-2.5-pro",
    "claude-haiku": "anthropic/claude-3-5-haiku-20241022",
}

# Default base path for images (WSL path)
DEFAULT_BASE_PATH = "/mnt/d/chemistry-scraped"


def get_db_connection():
    """Connect to PostgreSQL database."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        sslmode=os.getenv("DB_SSLMODE", "require"),
    )


def get_synthesis_name(conn, synthesis_id: int) -> str:
    """Get synthesis directory name from synthesis table."""
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM synthesis WHERE id = %s", (synthesis_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Synthesis ID {synthesis_id} not found")
        return row[0]


def get_steps_for_synthesis(conn, synthesis_id: int) -> list:
    """
    Get all unique step base_filenames for a synthesis.

    Returns list of base_filenames like ['sequence_01', 'sequence_02', ...]
    """
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
    """
    Fetch 3 SMILES records from DB for a given image.
    """
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


def build_messages(prompt: str, image_path: Path, existing_smiles: dict) -> list:
    """Build the message list for LLM API call."""
    smiles_json = json.dumps({
        "reactant": existing_smiles["reactant"]["smiles"],
        "reagent": existing_smiles["reagent"]["smiles"],
        "product": existing_smiles["product"]["smiles"],
    }, indent=2)

    user_text = f"""Here are the current SMILES to validate:

```json
{smiles_json}
```

Confidence scores:
- Reactant: {existing_smiles['reactant']['confidence']:.2f}
- Reagent: {existing_smiles['reagent']['confidence']:.2f}
- Product: {existing_smiles['product']['confidence']:.2f}

Please validate these against the screenshot and provide corrected SMILES."""

    image_base64 = encode_image(image_path)
    image_media_type = "image/png"

    messages = [
        {"role": "system", "content": prompt},
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_media_type};base64,{image_base64}",
                    },
                },
                {
                    "type": "text",
                    "text": user_text,
                },
            ],
        },
    ]

    return messages


def call_llm(model_alias: str, messages: list) -> dict:
    """Call LLM via LiteLLM."""
    from litellm import completion, completion_cost

    model_id = MODELS.get(model_alias)
    if not model_id:
        raise ValueError(f"Unknown model alias: {model_alias}. Available: {list(MODELS.keys())}")

    response = completion(model=model_id, messages=messages)

    try:
        cost = completion_cost(completion_response=response)
    except Exception:
        cost = None

    usage = response.usage

    return {
        "content": response.choices[0].message.content,
        "usage": {
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "total_tokens": usage.total_tokens,
        },
        "cost": cost,
        "model": response.model,
    }


def parse_llm_response(content: str) -> dict:
    """
    Parse JSON from LLM response.

    Handles responses with markdown code blocks.
    """
    # Try to extract JSON from code block
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', content, re.DOTALL)
    if json_match:
        json_str = json_match.group(1).strip()
    else:
        # Try to find raw JSON
        json_str = content.strip()

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"  WARNING: Failed to parse JSON: {e}")
        print(f"  Raw content: {content[:200]}...")
        return None


def store_results(conn, synthesis_id: int, base_filename: str, existing_smiles: dict,
                   parsed: dict, model: str, cost: float, tokens: int):
    """
    Store step data in synthesis_steps table.

    Inserts a complete row with original + corrected SMILES.
    """
    if not parsed:
        print(f"  Skipping DB insert - no parsed results")
        return

    # Build image filename (e.g., sequence_01.png)
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
                llm_cost = EXCLUDED.llm_cost,
                tokens_used = EXCLUDED.tokens_used,
                processed_at = EXCLUDED.processed_at
            """,
            (
                synthesis_id, image_filename,
                # Original SMILES
                existing_smiles["reactant"]["smiles"],
                existing_smiles["reagent"]["smiles"],
                existing_smiles["product"]["smiles"],
                # Corrected SMILES
                parsed.get("reactant_smiles", ""),
                parsed.get("reagent_smiles", ""),
                parsed.get("product_smiles", ""),
                # Extracted text
                parsed.get("reagents", ""),
                parsed.get("conditions", ""),
                parsed.get("yield", ""),
                parsed.get("reaction_type", ""),
                parsed.get("notes", ""),
                # Quality tracking (as JSON)
                json.dumps(parsed.get("corrections_made", [])),
                json.dumps(parsed.get("continuity")) if parsed.get("continuity") else None,
                # Metadata
                model,
                cost,
                tokens,
                datetime.now(),
            ),
        )

    conn.commit()
    print(f"  Stored in synthesis_steps")


def process_synthesis(synthesis_id: int, base_path: str, model: str, dry_run: bool = False):
    """Process all steps for a synthesis."""
    conn = get_db_connection()

    try:
        # Get synthesis name
        synthesis_name = get_synthesis_name(conn, synthesis_id)
        print(f"\nSynthesis: {synthesis_name} (ID: {synthesis_id})")

        # Get all steps
        steps = get_steps_for_synthesis(conn, synthesis_id)
        print(f"Found {len(steps)} steps to process")

        if not steps:
            print("No steps found!")
            return

        # Load prompt once
        prompt = load_prompt()

        total_cost = 0
        total_tokens = 0

        for i, base_filename in enumerate(steps, 1):
            print(f"\n[{i}/{len(steps)}] Processing {base_filename}...")

            # Build image path
            image_path = Path(base_path) / synthesis_name / f"{base_filename}.png"

            if not image_path.exists():
                print(f"  WARNING: Image not found: {image_path}")
                continue

            # Fetch existing SMILES
            existing_smiles = fetch_smiles_for_image(conn, synthesis_id, base_filename)

            if dry_run:
                print(f"  Image: {image_path}")
                print(f"  Reactant: {existing_smiles['reactant']['smiles'][:50]}...")
                print(f"  Product: {existing_smiles['product']['smiles'][:50]}...")
                continue

            # Build messages and call LLM
            messages = build_messages(prompt, image_path, existing_smiles)
            result = call_llm(model, messages)

            # Parse response
            parsed = parse_llm_response(result["content"])

            if parsed:
                print(f"  Reactant: {parsed.get('reactant_smiles', 'N/A')[:50]}...")
                print(f"  Product: {parsed.get('product_smiles', 'N/A')[:50]}...")
                print(f"  Reagents: {parsed.get('reagents', 'N/A')}")
                if parsed.get('corrections_made'):
                    print(f"  Corrections: {parsed['corrections_made']}")

            # Store results
            store_results(
                conn, synthesis_id, base_filename, existing_smiles,
                parsed, model, result["cost"] or 0, result["usage"]["total_tokens"]
            )

            # Track costs
            if result["cost"]:
                total_cost += result["cost"]
            total_tokens += result["usage"]["total_tokens"]

            print(f"  Cost: ${result['cost']:.4f}" if result['cost'] else "  Cost: N/A")

        print(f"\n{'='*60}")
        print(f"SUMMARY")
        print(f"{'='*60}")
        print(f"Steps processed: {len(steps)}")
        print(f"Total tokens: {total_tokens:,}")
        print(f"Total cost: ${total_cost:.4f}")

    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Process all steps for a synthesis")
    parser.add_argument("--synthesis-id", type=int, required=True, help="Synthesis ID")
    parser.add_argument("--model", default=DEFAULT_MODEL, choices=list(MODELS.keys()), help="LLM model")
    parser.add_argument("--base-path", default=DEFAULT_BASE_PATH, help="Base path for images")
    parser.add_argument("--dry-run", action="store_true", help="Don't call LLM, just show what would be processed")

    args = parser.parse_args()

    process_synthesis(
        synthesis_id=args.synthesis_id,
        base_path=args.base_path,
        model=args.model,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
