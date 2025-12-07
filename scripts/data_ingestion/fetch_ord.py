import json
import os
import sys
import urllib.request
import urllib.error

# Configuration
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'public', 'data')
IMPORTED_DIR = os.path.join(DATA_DIR, 'imported')
INDEX_FILE = os.path.join(DATA_DIR, 'index.json')

# Sample ORD Data URL (Using a raw GitHub URL for a sample dataset if available, or a reliable mock/example)
# Since direct ORD JSON URLs are varying, we will simulate the structure of an incoming ORD JSON 
# based on the schema documentation for demonstration purposes.
# In a real scenario, this would point to specific synthesis datasets.
SAMPLE_DATA_URLS = [
    # Placeholder for a real ORD JSON url.
    # checking for a valid raw json URL in the next steps or using a local mock for now to ensure robustness
]

def ensure_directories():
    if not os.path.exists(IMPORTED_DIR):
        os.makedirs(IMPORTED_DIR)
        print(f"Created directory: {IMPORTED_DIR}")

def map_ord_to_app_schema(ord_reaction, index):
    """
    Maps an ORD reaction object to our application's synthesis schema.
    This is a simplified mapper.
    """
    # Defensive extraction
    ident = ord_reaction.get('identifiers', [{}])[0] if ord_reaction.get('identifiers') else {}
    target_name = ident.get('value', f"Unknown Molecule {index}")
    
    # Create simple ID
    safe_name = "".join(c for c in target_name if c.isalnum() or c in ('-','_')).lower()
    reaction_id = f"ord-{safe_name}-{index}"
    
    steps = []
    # ORD 'inputs' and 'outcomes' are often complex. We simplify.
    # Assuming 'inputs' is a dict of components
    
    # We will just create a single step for the whole reaction for this MVP mapper
    # unless 'steps' are defined explicitly.
    
    # Heuristic: Take first reactant and first product
    reactant_smiles = "C" # Default
    product_smiles = "C" # Default
    
    if 'inputs' in ord_reaction:
        first_input = next(iter(ord_reaction['inputs'].values()), None)
        if first_input and 'components' in first_input:
             reactant_smiles = first_input['components'][0].get('identifiers', [{}])[0].get('value', 'C')

    if 'outcomes' in ord_reaction:
        first_outcome = ord_reaction['outcomes'][0] if ord_reaction['outcomes'] else {}
        if 'products' in first_outcome:
             product_smiles = first_outcome['products'][0].get('identifiers', [{}])[0].get('value', 'C')

    steps.append({
        "step_id": 1,
        "reaction_type": "Imported Synthesis",
        "reagents": "See ORD Data",
        "conditions": "Standard",
        "yield": "N/A",
        "reactant_smiles": reactant_smiles,
        "product_smiles": product_smiles,
        "notes": "Imported from Open Reaction Database"
    })

    return {
        "$schema": "../schema.json",
        "meta": {
            "id": reaction_id,
            "molecule_name": target_name,
            "class": "Imported",
            "author": "Open Reaction Database",
            "year": 2024,
            "source_url": "https://open-reaction-database.org"
        },
        "sequence": steps
    }, reaction_id

def main():
    print("Starting ORD Data Ingestion...")
    ensure_directories()
    
    # Mocking a fetched ORD reaction for demonstration as direct raw URLs can be unstable 
    # or require protobuf parsing which we want to avoid for this lightweight script.
    mock_ord_reactions = [
        {
            "identifiers": [{"type": "NAME", "value": "Cephalotaxine"}],
            "inputs": {
                "input1": {
                    "components": [{"identifiers": [{"type": "SMILES", "value": "C1=CC=C(C=C1)O"}]}]
                }
            },
            "outcomes": [
                {
                    "products": [{"identifiers": [{"type": "SMILES", "value": "COC1=CC=CC=C1O"}]}]
                }
            ]
        }
    ]
    
    new_entries = []
    
    for i, rxn in enumerate(mock_ord_reactions):
        app_data, rxn_id = map_ord_to_app_schema(rxn, i+1)
        filename = f"{rxn_id}.json"
        
        output_path = os.path.join(IMPORTED_DIR, filename)
        with open(output_path, 'w') as f:
            json.dump(app_data, f, indent=4)
        print(f"Saved {filename}")
        
        new_entries.append({
            "id": rxn_id,
            "molecule_name": app_data['meta']['molecule_name'],
            "class": "Imported",
            "author": "ORD",
            "year": 2024,
            "path": f"/data/imported/{filename}"
        })
        
    # Update Index
    try:
        with open(INDEX_FILE, 'r+') as f:
            index_data = json.load(f)
            
            # Remove existing entries with same IDs to avoid duplicates
            existing_ids = {e['id'] for e in new_entries}
            index_data = [e for e in index_data if e['id'] not in existing_ids]
            
            index_data.extend(new_entries)
            
            f.seek(0)
            json.dump(index_data, f, indent=4)
            f.truncate()
        print("Updated index.json")
    except Exception as e:
        print(f"Error updating index: {e}")

if __name__ == "__main__":
    main()
