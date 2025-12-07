#!/usr/bin/env python3
"""Search ORD datasets for prostaglandin-related reactions."""

import os
import glob
import gzip
from ord_schema import message_helpers
from ord_schema.proto import dataset_pb2, reaction_pb2

# Keywords to search for
KEYWORDS = [
    'prostaglandin', 'pgf2', 'pge2', 'corey lactone', 'corey aldehyde',
    'cyclopentadiene', 'diels-alder', 'chloroacrylonitrile'
]

# SMILES patterns (substrings) to look for
SMILES_PATTERNS = [
    'CC(=O)O[C@@H]1C[C@H]2[C@@H]',  # Corey lactone fragment
    'C=C(C#N)Cl',  # 2-chloroacrylonitrile
]

def search_dataset(dataset_path):
    """Search a single dataset for matching reactions."""
    matches = []

    try:
        dataset = message_helpers.load_message(dataset_path, dataset_pb2.Dataset)
    except Exception as e:
        print(f"  Error loading {dataset_path}: {e}")
        return matches

    for rxn in dataset.reactions:
        found = False
        match_info = {'reaction_id': rxn.reaction_id, 'matches': []}

        # Search in product identifiers
        for outcome in rxn.outcomes:
            for product in outcome.products:
                for ident in product.identifiers:
                    # Check NAME type
                    if ident.type == reaction_pb2.CompoundIdentifier.NAME:
                        for kw in KEYWORDS:
                            if kw.lower() in ident.value.lower():
                                match_info['matches'].append(f"Product name: {ident.value}")
                                found = True
                    # Check SMILES type
                    if ident.type == reaction_pb2.CompoundIdentifier.SMILES:
                        for pattern in SMILES_PATTERNS:
                            if pattern in ident.value:
                                match_info['matches'].append(f"Product SMILES match: {ident.value[:50]}...")
                                found = True

        # Search in reactant identifiers
        for input_key in rxn.inputs:
            inp = rxn.inputs[input_key]
            for comp in inp.components:
                for ident in comp.identifiers:
                    if ident.type == reaction_pb2.CompoundIdentifier.NAME:
                        for kw in KEYWORDS:
                            if kw.lower() in ident.value.lower():
                                match_info['matches'].append(f"Reactant name: {ident.value}")
                                found = True
                    if ident.type == reaction_pb2.CompoundIdentifier.SMILES:
                        for pattern in SMILES_PATTERNS:
                            if pattern in ident.value:
                                match_info['matches'].append(f"Reactant SMILES match: {ident.value[:50]}...")
                                found = True

        if found:
            matches.append(match_info)

    return matches

def main():
    # Look for downloaded .pb.gz files in the scripts directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pb_files = glob.glob(os.path.join(script_dir, "*.pb.gz"))

    print(f"Found {len(pb_files)} dataset files to search")
    print(f"Keywords: {KEYWORDS}")
    print(f"SMILES patterns: {SMILES_PATTERNS}")
    print("-" * 60)

    all_matches = []

    for pb_file in pb_files:
        print(f"\nSearching: {os.path.basename(pb_file)}")
        matches = search_dataset(pb_file)
        if matches:
            print(f"  Found {len(matches)} matching reactions!")
            for m in matches[:5]:  # Show first 5
                print(f"    - {m['reaction_id']}")
                for info in m['matches'][:2]:
                    print(f"      {info}")
            all_matches.extend(matches)
        else:
            print("  No matches found")

    print("\n" + "=" * 60)
    print(f"TOTAL: {len(all_matches)} matching reactions found")

    if all_matches:
        print("\nAll reaction IDs:")
        for m in all_matches:
            print(f"  {m['reaction_id']}")

if __name__ == "__main__":
    main()
