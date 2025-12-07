import json
import os
import random

# Configuration
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'public', 'data')
IMPORTED_DIR = os.path.join(DATA_DIR, 'imported')
INDEX_FILE = os.path.join(DATA_DIR, 'index.json')

# The Specific List of 100 Reactions
# Format: (Name, Description/Reaction Name, Class, Year, Author)
REACTIONS_LIST = [
    # --- Part 1: Natural Product Total Syntheses (50) ---
    ("Strychnine", "Woodward Total Synthesis", "Alkaloid", 1954, "Woodward, R.B."),
    ("Quinine", "Woodward-Doering Synthesis", "Alkaloid", 1944, "Woodward, R.B."),
    ("Reserpine", "Woodward Synthesis", "Alkaloid", 1956, "Woodward, R.B."),
    ("Lysergic Acid", "Woodward Synthesis", "Alkaloid", 1954, "Woodward, R.B."),
    ("Chlorophyll a", "Woodward Synthesis", "Porphyrin", 1960, "Woodward, R.B."),
    ("Vitamin B12", "Woodward-Eschenmoser Synthesis", "Vitamin", 1972, "Woodward, R.B."),
    ("Cholesterol", "Robinson-Woodward Synthesis", "Steroid", 1951, "Woodward, R.B."),
    ("Cortisone", "Woodward-Sarett Synthesis", "Steroid", 1951, "Woodward, R.B."),
    ("Colchicine", "Eschenmoser-Woodward Synthesis", "Alkaloid", 1963, "Woodward, R.B."),
    ("Cephalosporin C", "Woodward Synthesis", "Antibiotic", 1966, "Woodward, R.B."),
    ("Taxol", "Nicolaou Total Synthesis", "Terpene", 1994, "Nicolaou, K.C."),
    ("Taxol", "Holton Total Synthesis", "Terpene", 1994, "Holton, R.A."),
    ("Epothilone A", "Danishefsky Synthesis", "Macrolide", 1996, "Danishefsky, S.J."),
    ("Epothilone B", "Nicolaou Synthesis", "Macrolide", 1996, "Nicolaou, K.C."),
    ("Brevetoxin B", "Nicolaou Synthesis", "Polyether", 1995, "Nicolaou, K.C."),
    ("Rapamycin", "Nicolaou Synthesis", "Macrolide", 1993, "Nicolaou, K.C."),
    ("Vancomycin", "Nicolaou Synthesis", "Peptide", 1998, "Nicolaou, K.C."),
    ("Calyculin A", "Evans Synthesis", "Marine Natural Product", 1992, "Evans, D.A."),
    ("Palytoxin", "Kishi Synthesis", "Marine Natural Product", 1994, "Kishi, Y."),
    ("Prostaglandin F2a", "Corey Synthesis", "Lipid", 1969, "Corey, E.J."),
    ("Ginkgolide B", "Corey Synthesis", "Terpene", 1988, "Corey, E.J."),
    ("Erythronolide B", "Corey Synthesis", "Macrolide", 1978, "Corey, E.J."),
    ("Salinosporamide A", "Corey Synthesis", "Alkaloid", 2004, "Corey, E.J."),
    ("Longifolene", "Corey Synthesis", "Terpene", 1961, "Corey, E.J."),
    ("Maytansine", "Corey Synthesis", "Alkaloid", 1980, "Corey, E.J."),
    ("Tetrodotoxin", "Kishi Synthesis", "Alkaloid", 1972, "Kishi, Y."),
    ("Monensin", "Kishi Synthesis", "Polyether", 1979, "Kishi, Y."),
    ("Mitomycin C", "Kishi Synthesis", "Aziridine", 1977, "Kishi, Y."),
    ("Batrachotoxin", "Kishi Synthesis", "Steroid", 1998, "Kishi, Y."),
    ("Halichondrin B", "Kishi Synthesis", "Macrolide", 1992, "Kishi, Y."),
    ("Erythromycin A", "Woodward Synthesis", "Macrolide", 1981, "Woodward, R.B."),
    ("Discodermolide", "Paterson Synthesis", "Polyketide", 2001, "Paterson, I."),
    ("Spongistatin 1", "Paterson Synthesis", "Macrolide", 2001, "Paterson, I."),
    ("Altohyrtin C", "Evans Synthesis", "Macrolide", 1997, "Evans, D.A."),
    ("Azadirachtin", "Ley Synthesis", "Limonoid", 2007, "Ley, S.V."),
    ("Vindoline", "Boger Synthesis", "Alkaloid", 2000, "Boger, D.L."),
    ("Vinblastine", "Boger Synthesis", "Alkaloid", 2002, "Boger, D.L."),
    ("Maoecrystal V", "Baran Synthesis", "Terpene", 2016, "Baran, P.S."),
    ("Palau'amine", "Baran Synthesis", "Alkaloid", 2011, "Baran, P.S."),
    ("Ingenol", "Baran Synthesis", "Terpene", 2013, "Baran, P.S."),
    ("Taxadiene", "Baran Synthesis", "Terpene", 2011, "Baran, P.S."),
    ("Thapsigargin", "Baran Synthesis", "Terpene", 2017, "Baran, P.S."),
    ("Ryanodine", "Reisman Synthesis", "Terpene", 2016, "Reisman, S.E."),
    ("Perseanol", "Reisman Synthesis", "Terpene", 2019, "Reisman, S.E."),
    ("Jiadifenolide", "Sorensen Synthesis", "Terpene", 2011, "Sorensen, E.J."),
    ("Penicillin V", "Sheehan Synthesis", "Antibiotic", 1957, "Sheehan, J.C."),
    ("Biotin", "Hoffmann-La Roche Synthesis", "Vitamin", 1949, "Goldberg, M.W."),
    ("Menthol", "Noyori Synthesis", "Terpene", 2001, "Noyori, R."),
    ("Camphor", "Komppa Synthesis", "Terpene", 1903, "Komppa, G."),
    ("Urea", "Wohler Synthesis", "Organic", 1828, "Wohler, F."),

    # --- Part 2: Approved Pharmaceuticals (50) ---
    ("Aspirin", "Acetylsalicylic acid synthesis", "Pharmaceutical", 1897, "Hoffmann, F."),
    ("Ibuprofen", "Boot Process", "Pharmaceutical", 1960, "Adams, S.S."),
    ("Acetaminophen", "Paracetamol Industrial", "Pharmaceutical", 1877, "Morse, H.N."),
    ("Lipitor", "Atorvastatin Calcium", "Pharmaceutical", 1985, "Roth, B.D."),
    ("Plavix", "Clopidogrel Synthesis", "Pharmaceutical", 1986, "Sanofi"),
    ("Nexium", "Esomeprazole Synthesis", "Pharmaceutical", 2000, "AstraZeneca"),
    ("Advair", "Fluticasone/Salmeterol", "Pharmaceutical", 2000, "GSK"),
    ("Abilify", "Aripiprazole Synthesis", "Pharmaceutical", 2002, "Otsuka"),
    ("Humira", "Adalimumab (Biological)", "Biological", 2002, "AbbVie"),
    ("Crestor", "Rosuvastatin Synthesis", "Pharmaceutical", 2003, "Shionogi"),
    ("Cymbalta", "Duloxetine Synthesis", "Pharmaceutical", 2004, "Lilly"),
    ("Lyrica", "Pregabalin Synthesis", "Pharmaceutical", 2004, "Pfizer"),
    ("Spiriva", "Tiotropium Bromide", "Pharmaceutical", 2004, "Boehringer"),
    ("Lantus", "Insulin Glargine", "Biological", 2000, "Sanofi"),
    ("Viagra", "Sildenafil Citrate", "Pharmaceutical", 1998, "Pfizer"),
    ("Cialis", "Tadalafil Synthesis", "Pharmaceutical", 2003, "Lilly"),
    ("Prozac", "Fluoxetine Synthesis", "Pharmaceutical", 1987, "Lilly"),
    ("Zoloft", "Sertraline Synthesis", "Pharmaceutical", 1991, "Pfizer"),
    ("Xanax", "Alprazolam Synthesis", "Pharmaceutical", 1981, "Upjohn"),
    ("Valium", "Diazepam Synthesis", "Pharmaceutical", 1963, "Roche"),
    ("Adderall", "Amphetamine Salts", "Pharmaceutical", 1996, "Richwood"),
    ("Ritalin", "Methylphenidate", "Pharmaceutical", 1955, "Ciba"),
    ("Ambien", "Zolpidem Synthesis", "Pharmaceutical", 1992, "Sanofi"),
    ("OxyContin", "Oxycodone Synthesis", "Pharmaceutical", 1995, "Purdue"),
    ("Vicodin", "Hydrocodone Synthesis", "Pharmaceutical", 1978, "Knoll"),
    ("Amoxicillin", "Amoxicillin Synthesis", "Antibiotic", 1972, "Beecham"),
    ("Azithromycin", "Z-Pak Synthesis", "Antibiotic", 1980, "Pliva"),
    ("Cipro", "Ciprofloxacin Synthesis", "Antibiotic", 1987, "Bayer"),
    ("Metformin", "Glucophage Synthesis", "Pharmaceutical", 1922, "Werner, E."),
    ("Synthroid", "Levothyroxine", "Pharmaceutical", 1955, "Abbott"),
    ("Eliquis", "Apixaban Synthesis", "Pharmaceutical", 2012, "BMS/Pfizer"),
    ("Xarelto", "Rivaroxaban Synthesis", "Pharmaceutical", 2011, "Bayer"),
    ("Revlimid", "Lenalidomide Synthesis", "Pharmaceutical", 2005, "Celgene"),
    ("Imbruvica", "Ibrutinib Synthesis", "Pharmaceutical", 2013, "Pharmacyclics"),
    ("Keytruda", "Pembrolizumab", "Biological", 2014, "Merck"),
    ("Opdivo", "Nivolumab", "Biological", 2014, "BMS"),
    ("Ibrance", "Palbociclib Synthesis", "Pharmaceutical", 2015, "Pfizer"),
    ("Tagrisso", "Osimertinib Synthesis", "Pharmaceutical", 2015, "AstraZeneca"),
    ("Biktarvy", "Bictegravir Synthesis", "Pharmaceutical", 2018, "Gilead"),
    ("Genvoya", "Elvitegravir Synthesis", "Pharmaceutical", 2015, "Gilead"),
    ("Trikafta", "Elexacaftor Synthesis", "Pharmaceutical", 2019, "Vertex"),
    ("Dupixent", "Dupilumab", "Biological", 2017, "Regeneron"),
    ("Ozempic", "Semaglutide Synthesis", "Pharmaceutical", 2017, "Novo Nordisk"),
    ("Mounjaro", "Tirzepatide Synthesis", "Pharmaceutical", 2022, "Lilly"),
    ("Entresto", "Sacubitril Synthesis", "Pharmaceutical", 2015, "Novartis"),
    ("Gardasil", "VLP Assembly", "Vaccine", 2006, "Merck"),
    ("Shingrix", "Antigen Synthesis", "Vaccine", 2017, "GSK"),
    ("Prevnar 13", "Conjugate Synthesis", "Vaccine", 2010, "Wyeth"),
    ("Sovaldi", "Sofosbuvir Synthesis", "Pharmaceutical", 2013, "Gilead"),
    ("Tamiflu", "Oseltamivir Synthesis", "Pharmaceutical", 1999, "Roche")
]

REAGENTS = ["H2SO4", "NaOH", "Pd/C", "LiAlH4", "NaBH4", "KMnO4", "O3", "SOCl2", "NH3", "HCl", "n-BuLi", "LDA", "Grignard"]
SOLVENTS = ["THF", "DCM", "EtOH", "MeOH", "H2O", "DMSO", "DMF", "Ether", "Toluene", "Acetone", "Benzene"]
CONDITIONS = ["Reflux, 2h", "RT, 12h", "0°C, 30min", "100°C, 5h", "-78°C, 1h", "High Pressure", "Microwave"]

def ensure_directories():
    if not os.path.exists(IMPORTED_DIR):
        os.makedirs(IMPORTED_DIR)

def generate_reaction(index, item):
    name, desc, cls, year, author = item
    
    # Create a safe ID
    safe_name = "".join(c for c in name if c.isalnum() or c in ('-','_')).lower()
    rxn_id = f"rxn-{safe_name}-{index+1}"
    
    # Generate 1-5 random pseudo-steps to simulate the synthesis
    num_steps = random.randint(3, 8) if cls in ["Alkaloid", "Terpene", "Macrolide"] else random.randint(1, 4)
    steps = []
    
    for i in range(1, num_steps + 1):
        steps.append({
            "step_id": i,
            "reaction_type": random.choice(["Oxidation", "Reduction", "Esterification", "Hydrolysis", "Coupling", "Aldol", "Diels-Alder", "Cyclization"]),
            "reagents": f"{random.choice(REAGENTS)}, {random.choice(REAGENTS)}",
            "conditions": f"{random.choice(CONDITIONS)}, {random.choice(SOLVENTS)}",
            "yield": f"{random.randint(40, 99)}%",
            "reactant_smiles": "C" * random.randint(3, 15), # Mock SMILES
            "product_smiles": "C" * random.randint(5, 20) + "O", # Mock SMILES
            "notes": f"Step {i} of {name} synthesis ({desc})."
        })

    data = {
        "$schema": "../schema.json",
        "meta": {
            "id": rxn_id,
            "molecule_name": name,
            "class": cls,
            "author": author,
            "year": year,
            "source_url": "https://example.com/synthesis"
        },
        "sequence": steps
    }
    
    return data, rxn_id

def main():
    print(f"Generating {len(REACTIONS_LIST)} specific curated reactions...")
    ensure_directories()
    
    new_entries = []
    
    for i, item in enumerate(REACTIONS_LIST):
        data, rxn_id = generate_reaction(i, item)
        filename = f"{rxn_id}.json"
        filepath = os.path.join(IMPORTED_DIR, filename)
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=4)
            
        new_entries.append({
            "id": rxn_id,
            "molecule_name": data['meta']['molecule_name'],
            "class": data['meta']['class'],
            "author": data['meta']['author'],
            "year": data['meta']['year'],
            "path": f"/data/imported/{filename}"
        })
        
    # Update Index
    try:
        with open(INDEX_FILE, 'r+') as f:
            current_index = json.load(f)
            
            # Remove previous "custom-rxn" mock entries to keep it clean, but keep original static ones
            # Filter out anything from the /imported/ folder to do a fresh import of this batch
            cleaned_index = [e for e in current_index if not e['path'].startswith('/data/imported/')]
            
            cleaned_index.extend(new_entries)
            
            f.seek(0)
            json.dump(cleaned_index, f, indent=4)
            f.truncate()
        print("Successfully generated 100 reactions and updated index.json")
    except Exception as e:
        print(f"Error updating index: {e}")

if __name__ == "__main__":
    main()
