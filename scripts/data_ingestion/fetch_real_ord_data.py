import os
import json
import urllib.request
import ord_schema
from ord_schema import message_helpers
from ord_schema.proto import dataset_pb2
from ord_schema.proto import reaction_pb2

# Configuration
DATASET_ID = "ord_dataset-01dbb772c5e249108f0b191ed17a2c0c"
# GitHub Raw URL
DATASET_URL = f"https://github.com/Open-Reaction-Database/ord-data/raw/main/data/01/{DATASET_ID}.pb.gz"

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'public', 'data')
IMPORTED_DIR = os.path.join(DATA_DIR, 'imported')
INDEX_FILE = os.path.join(DATA_DIR, 'index.json')
DOWNLOAD_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"{DATASET_ID}.pb.gz")

def ensure_directories():
    if not os.path.exists(IMPORTED_DIR):
        os.makedirs(IMPORTED_DIR)

def download_dataset():
    print(f"Downloading dataset {DATASET_ID}...")
    if not os.path.exists(DOWNLOAD_PATH):
        try:
            urllib.request.urlretrieve(DATASET_URL, DOWNLOAD_PATH)
            print("Download complete.")
        except Exception as e:
            print(f"Failed to download: {e}")
            return False
    else:
        print("File already exists.")
    return True

def extract_reactions(limit=100):
    print("Parsing dataset...")
    try:
        # Load the dataset
        dataset = message_helpers.load_message(DOWNLOAD_PATH, dataset_pb2.Dataset)
    except Exception as e:
        print(f"Error parsing PB file: {e}")
        return []

    reactions = []
    count = 0
    
    for reaction in dataset.reactions:
        if count >= limit:
            break
            
        # Extract basic info
        rxn_id = reaction.reaction_id
        
        # Try to find a product name
        molecule_name = "Unknown Product"
        product_smiles = ""
        measured_yield = "N/A"
        
        if reaction.outcomes:
            outcome = reaction.outcomes[0]
            if outcome.products:
                prod = outcome.products[0]
                if prod.identifiers:
                    for ident in prod.identifiers:
                        if ident.type == reaction_pb2.CompoundIdentifier.NAME:
                            molecule_name = ident.value
                            break
                # If no name, try SMILES
                for ident in prod.identifiers:
                    if ident.type == reaction_pb2.CompoundIdentifier.SMILES:
                        product_smiles = ident.value
                        if molecule_name == "Unknown Product":
                             molecule_name = "Chemical Product" # Fallback
                        break
                
                # Yield
                if prod.measurements:
                    for m in prod.measurements:
                        if m.type == reaction_pb2.ProductMeasurement.YIELD:
                            measured_yield = f"{m.percentage.value:.1f}%"
                            break

        # Extract Reactants
        reactant_smiles = []
        reagent_names = []
        for input_key in reaction.inputs:
            inp = reaction.inputs[input_key]
            for comp in inp.components:
                # Name
                comp_name = ""
                for ident in comp.identifiers:
                    if ident.type == reaction_pb2.CompoundIdentifier.NAME:
                        comp_name = ident.value
                        break
                if comp_name:
                    reagent_names.append(comp_name)
                
                # SMILES
                for ident in comp.identifiers:
                    if ident.type == reaction_pb2.CompoundIdentifier.SMILES:
                        reactant_smiles.append(ident.value)
                        break

        # Extract Conditions (Simplified)
        conditions_str = "Standard Conditions"
        if reaction.conditions.temperature.setpoint.value:
            conditions_str = f"{reaction.conditions.temperature.setpoint.value}°C"
        
        # Meta info
        author = "ORD Contributor"
        year = 2020
        if reaction.provenance.record_created.time.value:
            # simple parsing or default
            pass

        # Construct our JSON object
        mapped_rxn = {
            "$schema": "../schema.json",
            "meta": {
                "id": rxn_id,
                "molecule_name": molecule_name,
                "class": "ORD Import",
                "author": author,
                "year": year,
                "source_url": f"https://open-reaction-database.org/client/id/{rxn_id}"
            },
            "sequence": [
                {
                    "step_id": 1,
                    "reaction_type": "Synthesis",
                    "reagents": ", ".join(reagent_names[:3]), # First 3 reagents
                    "conditions": conditions_str,
                    "yield": measured_yield,
                    "reactant_smiles": reactant_smiles[0] if reactant_smiles else "",
                    "product_smiles": product_smiles,
                    "notes": "Imported from Open Reaction Database"
                }
            ]
        }
        
        # Only add if we have some valid data
        if product_smiles:
            reactions.append(mapped_rxn)
            count += 1
            
    return reactions

def main():
    ensure_directories()
    if download_dataset():
        reactions = extract_reactions(105) # Fetch a few more to filter bad ones
        
        new_entries = []
        for i, rxn in enumerate(reactions):
            if i >= 100: break
            
            filename = f"ord-{i+1}.json"
            filepath = os.path.join(IMPORTED_DIR, filename)
            
            # Override ID to be simple
            rxn['meta']['id'] = f"ord-real-{i+1}"
            
            with open(filepath, 'w') as f:
                json.dump(rxn, f, indent=4)
                
            new_entries.append({
                "id": f"ord-real-{i+1}",
                "molecule_name": rxn['meta']['molecule_name'],
                "class": "ORD Real Data",
                "author": "ORD",
                "year": 2024,
                "path": f"/data/imported/{filename}",
                "step_count": len(rxn['sequence'])
            })
            
        # Update Index
        try:
            with open(INDEX_FILE, 'r+') as f:
                current_index = json.load(f)
                cleaned_index = [e for e in current_index if not e['path'].startswith('/data/imported/')]
                cleaned_index.extend(new_entries)
                f.seek(0)
                json.dump(cleaned_index, f, indent=4)
                f.truncate()
            print(f"Successfully imported {len(new_entries)} real ORD reactions.")
        except Exception as e:
            print(f"Error updating index: {e}")

if __name__ == "__main__":
    main()
