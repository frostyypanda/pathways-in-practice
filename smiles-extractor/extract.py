#!/usr/bin/env python3
"""
SMILES Extractor - Validate and correct SMILES from chemistry screenshots using LLMs.

Usage:
    python extract.py --synthesis-id 3398 --step 1 --dry-run
    python extract.py --synthesis-id 3398 --step 1 --model claude-haiku
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Model aliases to LiteLLM model IDs
MODELS = {
    "claude-sonnet": "anthropic/claude-3-5-sonnet-20241022",
    "claude-haiku": "anthropic/claude-3-5-haiku-20241022",
    "claude-sonnet-4.5": "anthropic/claude-sonnet-4-5-20250929",
    "claude-haiku-4.5": "anthropic/claude-haiku-4-5-20251001",
    "gpt-4o": "openai/gpt-4o",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-5.1": "openai/gpt-5.1",
    "gpt-5": "openai/gpt-5",
    "gpt-5-mini": "openai/gpt-5-mini",
    "gpt-5-nano": "openai/gpt-5-nano",
    "gemini-2.5-flash": "gemini/gemini-2.5-flash",
    "gemini-2.5-flash-lite": "gemini/gemini-2.5-flash-lite",
    "gemini-2.5-pro": "gemini/gemini-2.5-pro",
    "gemini-3-pro-preview": "gemini/gemini-3-pro-preview",
    "gemini-2.0-flash": "gemini/gemini-2.0-flash",
    "gemini-1.5-flash": "gemini/gemini-1.5-flash",
}

# Default base path for images (Windows path)
DEFAULT_BASE_PATH = r"D:\chemistry-scraped"


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


def fetch_smiles_for_image(conn, synthesis_id: int, base_filename: str) -> dict:
    """
    Fetch 3 SMILES records from DB for a given image.

    Args:
        conn: Database connection
        synthesis_id: ID from synthesis table
        base_filename: Base name like "sequence_01" (without extension)

    Returns:
        Dict with reactant, reagent, product SMILES and confidence scores
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
    # Path relative to this script
    script_dir = Path(__file__).parent
    prompt_path = script_dir.parent / "docs" / "SINGLE_STEP_SMILES_VALIDATION_PROMPT.md"

    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

    return prompt_path.read_text(encoding="utf-8")


def encode_image(image_path: Path) -> str:
    """Encode image to base64 string."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def build_messages(prompt: str, image_path: Path, existing_smiles: dict, use_cache: bool = True) -> list:
    """
    Build the message list for LLM API call.

    Args:
        prompt: The system prompt
        image_path: Path to the image file
        existing_smiles: Dict with reactant, reagent, product SMILES
        use_cache: Whether to use prompt caching

    Returns:
        List of messages for LiteLLM
    """
    # Build the user message with existing SMILES
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

    # Encode image
    image_base64 = encode_image(image_path)
    image_media_type = "image/png"

    # Build messages with cache_control for Anthropic
    if use_cache:
        # System message with cache_control
        messages = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            },
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
    else:
        # Simple messages without cache_control
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
    """
    Call LLM via LiteLLM.

    Args:
        model_alias: Model alias (e.g., "claude-haiku")
        messages: List of messages

    Returns:
        Dict with response and usage info
    """
    from litellm import completion, completion_cost

    model_id = MODELS.get(model_alias)
    if not model_id:
        raise ValueError(f"Unknown model alias: {model_alias}. Available: {list(MODELS.keys())}")

    response = completion(model=model_id, messages=messages)

    # Calculate cost
    try:
        cost = completion_cost(completion_response=response)
    except Exception:
        cost = None

    return {
        "content": response.choices[0].message.content,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
            # Cache info if available
            "cached_tokens": getattr(getattr(response.usage, "prompt_tokens_details", None), "cached_tokens", 0) or 0,
        },
        "cost": cost,
        "model": response.model,
    }


def main():
    parser = argparse.ArgumentParser(description="SMILES Extractor - Validate SMILES from chemistry screenshots")
    parser.add_argument("--synthesis-id", type=int, required=True, help="Synthesis ID from database")
    parser.add_argument("--step", type=int, required=True, help="Step number (e.g., 1 for sequence_01.png)")
    parser.add_argument("--model", default="claude-haiku", choices=list(MODELS.keys()), help="LLM model to use")
    parser.add_argument("--base-path", default=DEFAULT_BASE_PATH, help="Base path for images")
    parser.add_argument("--dry-run", action="store_true", help="Print prompt and image path without calling LLM")
    parser.add_argument("--no-cache", action="store_true", help="Disable prompt caching (required for Gemini with small prompts)")

    args = parser.parse_args()

    # Connect to database
    print(f"Connecting to database...")
    conn = get_db_connection()

    try:
        # Get synthesis name (directory name)
        synthesis_name = get_synthesis_name(conn, args.synthesis_id)
        print(f"Synthesis: {synthesis_name} (ID: {args.synthesis_id})")

        # Build image path
        base_filename = f"sequence_{args.step:02d}"
        image_path = Path(args.base_path) / synthesis_name / f"{base_filename}.png"
        print(f"Image file: {image_path}")

        if not image_path.exists():
            print(f"ERROR: Image file not found: {image_path}")
            sys.exit(1)

        # Fetch existing SMILES from database
        existing_smiles = fetch_smiles_for_image(conn, args.synthesis_id, base_filename)
        print(f"\nExisting SMILES from database:")
        print(f"  Reactant (conf {existing_smiles['reactant']['confidence']:.2f}): {existing_smiles['reactant']['smiles'][:80]}...")
        print(f"  Reagent  (conf {existing_smiles['reagent']['confidence']:.2f}): {existing_smiles['reagent']['smiles'][:80]}...")
        print(f"  Product  (conf {existing_smiles['product']['confidence']:.2f}): {existing_smiles['product']['smiles'][:80]}...")

        # Load prompt
        prompt = load_prompt()
        print(f"\nPrompt loaded: {len(prompt)} characters")

        if args.dry_run:
            # Dry run - just print info
            print("\n" + "="*60)
            print("DRY RUN - Not calling LLM")
            print("="*60)

            # Build the user message to show exactly what would be sent
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

            print("\n" + "="*60)
            print("SYSTEM PROMPT:")
            print("="*60)
            print(prompt)
            print("\n" + "="*60)
            print("USER MESSAGE:")
            print("="*60)
            print(user_text)
            print("\n" + "="*60)
            print("IMAGE ATTACHMENT:")
            print("="*60)
            print(f"File: {image_path}")
            print(f"Size: {image_path.stat().st_size} bytes")
            print(f"\nModel: {args.model} ({MODELS[args.model]})")
        else:
            # Build messages and call LLM
            use_cache = not args.no_cache
            print(f"\nBuilding messages for {args.model} (caching: {use_cache})...")
            messages = build_messages(prompt, image_path, existing_smiles, use_cache=use_cache)

            print(f"Calling LLM ({MODELS[args.model]})...")
            result = call_llm(args.model, messages)

            print(f"\n" + "="*60)
            print("LLM Response:")
            print("="*60)
            print(result["content"])
            print("\n" + "-"*60)
            print(f"Model: {result['model']}")
            print(f"Tokens: {result['usage']['prompt_tokens']:,} input + {result['usage']['completion_tokens']:,} output = {result['usage']['total_tokens']:,} total")
            if result['usage']['cached_tokens']:
                print(f"Cached: {result['usage']['cached_tokens']:,} tokens")
            if result['cost'] is not None:
                print(f"Cost: ${result['cost']:.6f}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
