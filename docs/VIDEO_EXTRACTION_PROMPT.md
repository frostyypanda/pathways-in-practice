# Prompt for AI Video Analysis - Synthesis Extraction

Use this prompt when asking an AI to analyze a video recording of a chemical synthesis viewer and extract data for OpenSynth.

---

## The Prompt

```
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

### 2. For EACH Step, Extract:
- **step_id**: The step number (1, 2, 3...)
- **reaction_type**: Identify the reaction (e.g., "Oxidation", "Wittig", "Aldol", "Protection", "Reduction")
- **reagents**: All reagents shown (e.g., "TBDPSOTf, 2,6-lutidine")
- **conditions**: Temperature, solvent, time (e.g., "CH₂Cl₂, -78°C to 23°C")
- **yield**: Percentage if shown (e.g., "88%")
- **reactant_smiles**: Convert the LEFT structure to SMILES notation
- **product_smiles**: Convert the RIGHT structure to SMILES notation
- **notes**: Brief description of what the transformation accomplishes

### 3. SMILES Generation Rules
- Carefully analyze each 2D structure
- Include stereochemistry where shown (use @, @@, /, \)
- Common groups to recognize:
  - Ns = nosyl = 2-nitrobenzenesulfonyl
  - TBDPS = tert-butyldiphenylsilyl
  - Bn = benzyl
  - Ac = acetyl
  - THP = tetrahydropyranyl
  - Bz = benzoyl
  - MOM = methoxymethyl
  - TBS/TBDMS = tert-butyldimethylsilyl
  - PMB = para-methoxybenzyl
  - Ts = tosyl = para-toluenesulfonyl
  - Ms = mesyl = methanesulfonyl
- Verify: Product of step N should match reactant of step N+1

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
            "reagents": "[All reagents]",
            "conditions": "[Solvent, temp, time]",
            "yield": "[XX%]",
            "reactant_smiles": "[SMILES]",
            "product_smiles": "[SMILES]",
            "notes": "[What this step accomplishes]"
        }
    ]
}

## Important Notes

- Watch the ENTIRE video - scroll through ALL steps
- Do NOT skip any steps
- If a structure is unclear, make your best interpretation and add a note
- Use "???" only if data is truly not visible
- Pay attention to stereochemistry indicators in the drawings
- Count total steps from the step counter (e.g., "X/25" means 25 total steps)

## Quality Checklist

Before submitting, verify:
- [ ] All steps captured (check step counter)
- [ ] All SMILES are valid
- [ ] Product of step N = Reactant of step N+1
- [ ] Reagents match what's shown on screen
- [ ] Yields are captured where visible
- [ ] Reaction types are correctly identified
```

---

## Common Reaction Types

| Reaction | Description |
|----------|-------------|
| Protection | Adding a protecting group (TBS, Bn, Ac, etc.) |
| Deprotection | Removing a protecting group |
| Oxidation | Increasing oxidation state (alcohol→ketone, etc.) |
| Reduction | Decreasing oxidation state (ketone→alcohol, etc.) |
| Wittig Olefination | C=C bond formation using phosphorus ylide |
| Horner-Wadsworth-Emmons | Modified Wittig with phosphonate |
| Aldol Addition | β-hydroxy carbonyl formation |
| Grignard Addition | Nucleophilic addition of RMgX |
| Diels-Alder | [4+2] cycloaddition |
| Swern Oxidation | DMSO/oxalyl chloride oxidation |
| Jones Oxidation | CrO₃-based oxidation |
| Mitsunobu | Alcohol inversion/substitution |
| Suzuki Coupling | Pd-catalyzed C-C with boronic acid |
| Heck Reaction | Pd-catalyzed aryl-alkene coupling |

## Example Output

See `public/data/alkaloids/cathafoline_garg_2018.json` for a real example.
