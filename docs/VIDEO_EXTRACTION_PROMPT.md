
You are analyzing a video recording of a chemical synthesis viewer application. Your task is to extract all synthesis data and generate a complete JSON file.

## Video Structure

The video shows:
1. **Header bar**: Contains molecule name, author, and year (e.g., "16-epi-2S-Cathafoline (Garg 2018)")
2. **Reaction viewer**: Shows step-by-step transformations that can be navigated with Previous/Next buttons
3. **Each step displays**:
   - LEFT: Reactant structure (2D chemical drawing)
   - CENTER: Reagents, conditions, and yield
   - RIGHT: Product structure (2D chemical drawing)
   - BOTTOM: Step counter (e.g., "4/25" means step 4 of 25 total)

## Your Tasks

### 1. Extract Metadata
From the header, identify:
- Molecule name
- Author name
- Year of publication
- **Source citation**: Look for journal/source information which may include journal name, year, volume, and page numbers (e.g., "Mini. Rev. Med. Chem. 2004, 4, 207"). Include the full citation with year, volume, and page numbers - not just the journal name.

### 2. For EACH Step, Extract:
- **step_id**: The step number (1, 2, 3...)
- **reaction_type**: Identify the reaction (e.g., "Oxidation", "Wittig", "Aldol", "Protection", "Reduction")
- **reagents**: Text names of reagents shown (e.g., "TBDPSOTf, 2,6-lutidine"). Only include reagents that are shown as text labels, NOT those shown as drawn structures.
- **reagent_smiles**: SMILES strings for reagents shown as drawn molecular structures (not text labels). Use SMILES dot notation to separate multiple structures (e.g., "CCO.CC(=O)O"). Leave as empty string "" if no structures are drawn. Note: A reagent should appear in EITHER `reagents` OR `reagent_smiles`, never both. If a structure is drawn with a text label, prefer `reagent_smiles` and omit from `reagents`.
- **conditions**: Temperature, solvent, time (e.g., "CH₂Cl₂, -78°C to 23°C")
- **yield**: Percentage if shown (e.g., "88%")
- **reactant_smiles**: Convert the LEFT structure to SMILES notation. If multiple reactants are shown, use SMILES dot notation to combine them (e.g., "CCO.CC=O" for two reactants).
- **reactant_split_by_plus**: Set to `true` if multiple reactants are shown with a "+" symbol between them, `false` if they are just shown side by side without a "+". Omit this field if there is only one reactant.
- **product_smiles**: Convert the RIGHT structure to SMILES notation. If multiple products are shown, use SMILES dot notation to combine them (e.g., "CCO.CC=O" for two products).
- **product_split_by_plus**: Set to `true` if multiple products are shown with a "+" symbol between them, `false` if they are just shown side by side without a "+". Omit this field if there is only one product.
- **reagent_split_by_plus**: Set to `true` if multiple reagent structures (in `reagent_smiles`) are shown with a "+" symbol between them, `false` if they are just shown side by side. Omit this field if there are zero or one reagent structures.
- **notes**: Brief description of what the transformation accomplishes

### 3. SMILES Generation Rules
- Carefully analyze each 2D structure
- Include stereochemistry where shown (use @, @@, /, \)
- Verify: Product of step N should match reactant of step N+1
- **Abbreviations**: You may use ANY abbreviation for protecting groups or functional groups by enclosing them in square brackets (must start with uppercase letter). Common examples: `[OEt]`, `[OMe]`, `[OAc]`, `[OBz]`, `[Ph]`, `[Bn]`, `[TBDPS]`, `[TBS]`, `[TIPS]`, `[TMS]`, `[PMB]`, `[Boc]`, `[Fmoc]`, `[Cbz]`, `[Ts]`, `[Ns]`, `[Bz]`, `[Ac]`. If they are shown in an abbreviated way in the video, do NOT draw them out, keep the abbreviation as it is. If they are drawn out, do not abbreviate them.

### 4. Output Format

Generate JSON in this exact format:

{
    "$schema": "../schema.json",
    "meta": {
        "id": "[molecule-author-year in lowercase with hyphens]",
        "molecule_name": "[Full molecule name]",
        "class": "[Alkaloid|Terpene|Pharmaceutical|Prostaglandin|Other]",
        "author": "[Author, Initials]",
        "year": [YYYY],
        "journal": "???",
        "doi": "???",
        "source_url": "???"
    },
    "sequence": [
        {
            "step_id": 1,
            "reaction_type": "[Reaction name]",
            "reagents": "[All reagents text]",
            "reagent_smiles": "[SMILES of drawn reagents]",
            "reagent_split_by_plus": false,
            "conditions": "[Solvent, temp, time]",
            "yield": "[XX%]",
            "reactant_smiles": "[SMILES]",
            "reactant_split_by_plus": false,
            "product_smiles": "[SMILES]",
            "product_split_by_plus": false,
            "notes": "[What this step accomplishes]"
        }
    ]
}

## Important Notes

- **Analyze each frame carefully**: Pause on each step and carefully examine all details - molecular structures, reagents, conditions, and yields. Do not rush through frames.
- Watch the ENTIRE video - scroll through ALL steps
- Do NOT skip any steps
- **Verify step count**: The step counter in the bottom right shows "X/N" format (e.g., "3/9" means step 3 of 9 total). You MUST extract exactly N steps. If your output has fewer steps than N, you have missed steps - go back and find them.
- **Multiple syntheses**: If a video contains multiple syntheses (different molecules), create a separate JSON file for each synthesis. Each JSON file must follow all the rules and format specified above.
- If a structure is unclear, make your best interpretation and add a note
- Use "???" only if data is truly not visible
- Pay attention to stereochemistry indicators in the drawings

## Quality Checklist

Before submitting, verify:
- [ ] Step count matches: Your output has exactly N steps where N is from the "X/N" counter
- [ ] All SMILES are valid
- [ ] Product of step N = Reactant of step N+1
- [ ] Reagents match what's shown on screen
- [ ] Yields are captured where visible
- [ ] Reaction types are correctly identified
```


## Example Output

{
    "$schema": "../schema.json",
    "meta": {
        "id": "cathafoline-garg-2018",
        "molecule_name": "16-epi-2(S)-Cathafoline",
        "class": "Alkaloid",
        "author": "Garg, N.K.",
        "year": 2018,
        "journal": "???",
        "doi": "???",
        "source_url": "???"
    },
    "sequence": [
        {
            "step_id": 1,
            "reaction_type": "Deprotection",
            "reagents": "LiOH·H₂O",
            "reagent_smiles": "",
            "conditions": "MeOH, 23°C",
            "yield": "89% (2 steps)",
            "reactant_smiles": "C#CCN(C1C=CCC(OC(=O)c2ccccc2)C1)S(=O)(=O)c3ccccc3[N+](=O)[O-]",
            "product_smiles": "C#CCN(C1C=CCC(O)C1)S(=O)(=O)c2ccccc2[N+](=O)[O-]",
            "notes": "Conversion of benzoate ester (OBz) to alcohol (OH)"
        },
        {
            "step_id": 2,
            "reaction_type": "Oxidation",
            "reagents": "PCC (Pyridinium chlorochromate)",
            "reagent_smiles": "",
            "conditions": "CH₂Cl₂, 23°C",
            "yield": "93%",
            "reactant_smiles": "C#CCN(C1C=CCC(O)C1)S(=O)(=O)c2ccccc2[N+](=O)[O-]",
            "product_smiles": "C#CCN(C1C=CCC(=O)C1)S(=O)(=O)c2ccccc2[N+](=O)[O-]",
            "notes": "Oxidation of alcohol to ketone"
        },
        {
            "step_id": 3,
            "reaction_type": "Silyl Enol Ether Formation",
            "reagents": "TBDPSOTf, 2,6-lutidine",
            "reagent_smiles": "",
            "conditions": "CH₂Cl₂, -78°C to 23°C",
            "yield": "88%",
            "reactant_smiles": "C#CCN(C1C=CCC(=O)C1)S(=O)(=O)c2ccccc2[N+](=O)[O-]",
            "product_smiles": "C#CCN(C1=CC=CC(O[Si](C(C)(C)C)(c2ccccc2)c3ccccc3)=C1)S(=O)(=O)c4ccccc4[N+](=O)[O-]",
            "notes": "Conversion of ketone to silyl enol ether (OTBDPS)"
        },
        {
            "step_id": 4,
            "reaction_type": "Palladium-Catalyzed Oxidative Cyclization",
            "reagents": "(i) Pd(OAc)₂, AgOTf; (ii) p-TsOH·H₂O",
            "reagent_smiles": "",
            "conditions": "PhMe, t-BuOH, 40°C",
            "yield": "???",
            "reactant_smiles": "C#CCN(C1=CC=CC(O[Si](C(C)(C)C)(c2ccccc2)c3ccccc3)=C1)S(=O)(=O)c4ccccc4[N+](=O)[O-]",
            "product_smiles": "???",
            "notes": "Formation of bicyclic enone framework"
        },
        {
            "step_id": 5,
            "reaction_type": "Ueno-Stork Radical Cyclization",
            "reagents": "(i) AcOH, H₂O; (ii) n-Bu₃SnH, AIBN",
            "reagent_smiles": "",
            "conditions": "(i) THF, 75°C; (ii) toluene, 75°C",
            "yield": "70% (2 steps)",
            "reactant_smiles": "CCOC1C(I)CC(C(=O)OC)C(CN(CC#C)S(=O)(=O)c2ccccc2[N+](=O)[O-])=C1",
            "product_smiles": "CCOC1C2CC(C(=O)OC)C3(CN(C2)S(=O)(=O)c4ccccc4[N+](=O)[O-])C=CC31",
            "notes": "Radical cyclization forms tricyclic core - propargyl radical cyclizes onto double bond to form bridged 5-membered ring system"
        }
    ]
}

