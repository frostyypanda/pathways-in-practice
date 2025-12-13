
import json
import os
import re

filenames = [
    "sequence_01.png", "sequence_02.png", "sequence_03.png", "sequence_04.png", 
    "sequence_05.png", "sequence_06.png", "sequence_07.png", "sequence_08.png", 
    "sequence_09.png", "sequence_10.png", "sequence_11.png", "sequence_12.png", 
    "sequence_12_sub_01.png", "sequence_12_sub_02.png", "sequence_12_sub_03.png", 
    "sequence_12_sub_04.png", "sequence_13.png", "sequence_14.png", "sequence_15.png", 
    "sequence_16.png", "sequence_17.png", "sequence_18.png", "sequence_18_sub_01.png", 
    "sequence_18_sub_02.png", "sequence_19.png", "sequence_20.png", "sequence_21.png", 
    "sequence_22.png", "sequence_23.png", "sequence_24.png", "sequence_25.png", 
    "sequence_26.png", "sequence_27.png", "sequence_27_sub_01.png", 
    "sequence_27_sub_02.png", "sequence_27_sub_03.png", "sequence_27_sub_04.png", 
    "sequence_27_sub_05.png", "sequence_27_sub_06.png", "sequence_27_sub_07.png", 
    "sequence_28.png", "sequence_29.png", "sequence_30.png", "sequence_31.png", 
    "sequence_31_sub_01.png", "sequence_31_sub_02.png", "sequence_31_sub_03.png", 
    "sequence_31_sub_04.png", "sequence_31_sub_05.png", "sequence_31_sub_06.png", 
    "sequence_31_sub_07.png", "sequence_31_sub_08.png", "sequence_31_sub_09.png", 
    "sequence_31_sub_10.png", "sequence_31_sub_11.png", "sequence_31_sub_11_sub_01.png", 
    "sequence_31_sub_11_sub_02.png", "sequence_31_sub_11_sub_03.png", 
    "sequence_31_sub_11_sub_04.png", "sequence_31_sub_11_sub_05.png", 
    "sequence_31_sub_11_sub_06.png", "sequence_31_sub_12.png", "sequence_31_sub_13.png", 
    "sequence_31_sub_14.png", "sequence_31_sub_15.png", "sequence_31_sub_16.png", 
    "sequence_32.png", "sequence_33.png"
]

def parse_filename(filename):
    # Remove extension
    name = os.path.splitext(filename)[0]
    # Split by _
    parts = name.split('_')
    
    # sequence_18 -> id="18"
    # sequence_18_sub_01 -> id="18.1"
    # sequence_18_sub_01_sub_05 -> id="18.1.5"
    
    # Identify numbers
    ids = []
    for part in parts:
        if part.isdigit():
            ids.append(str(int(part))) # remove leading zeros
            
    step_id = ".".join(ids)
    # sequence_18 -> parts: sequence, 18. ids: 18.
    # Actually checking the pattern:
    # sequence_X -> X
    # sequence_X_sub_Y -> X.Y
    
    return step_id

def create_step_object(step_id, filename):
    return {
        "step_id": step_id,
        "reaction_type": "[Analysis Required]",
        "reagents": f"[Extracted from {filename}]",
        "reagent_smiles": "",
        "conditions": "",
        "yield": "",
        "reactant_smiles": "",
        "product_smiles": "",
        "notes": "",
        "substeps": []
    }

# Build hierarchy
# We need a way to find parent.
# ID 18.1 parent is 18.
# ID 18.1.1 parent is 18.1.

steps_map = {} # Map id -> object

# Sort filenames to ensure parents come before children generally, but dictionary map handles it.
filenames.sort()

root_steps = []

# First pass: Create all objects
for f in filenames:
    sid = parse_filename(f)
    step_obj = create_step_object(sid, f)
    steps_map[sid] = step_obj

# Second pass: Link them
for f in filenames:
    sid = parse_filename(f)
    obj = steps_map[sid]
    
    if '.' in sid:
        parent_id = sid.rsplit('.', 1)[0]
        if parent_id in steps_map:
            steps_map[parent_id]['substeps'].append(obj)
        else:
            # Fallback if parent missing (should not happen in this dataset)
            root_steps.append(obj)
    else:
        root_steps.append(obj)

# Construct final JSON
output = {
    "$schema": "../schema.json",
    "meta": {
        "id": "calyculin-a-evans-1992",
        "molecule_name": "Calyculin A",
        "author": "Evans",
        "year": 1992,
        "source_url": "???"
    },
    "sequence": root_steps
}

print(json.dumps(output, indent=2))
