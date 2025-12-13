You are analyzing a directory of synthesis screenshot files. Your task is to extract synthesis data and generate a recursive JSON structure that reflects the hierarchy of the files.

## 1. Screenshot Structure

Each screenshot shows ONE step of a synthesis with:
- **Top Right Corner**: Synthesis name, author, and year (e.g., "16-epi-2S-Cathafoline (Garg 2018)") - use this to group steps by synthesis
- **Bottom Right Corner**: Step number (e.g., "4/25" means step 4 of 25 total) - use this to sort steps
- **Each screenshot displays**:
  - **LEFT**: Reactant structure (2D chemical drawing)
  - **CENTER**: Reagents, conditions, and yield (above/below arrow)
  - **RIGHT**: Product structure (2D chemical drawing)

## 2. File Structure & Hierarchy Analysis

**CRITICAL**: Analyze filenames to understand the structure.

The filenames follow a recursive pattern:
- **Level 1 (Top)**: `sequence_X.png` (e.g., `sequence_1.png`)
- **Level 2 (Substep)**: `sequence_X_sub_Y.png` (e.g., `sequence_1_sub_01.png`)
- **Level 3 (Sub-Substep)**: `sequence_X_sub_Y_sub_Z.png` (e.g., `sequence_1_sub_02_sub_01.png`)
- **Level 4+**: Continues this pattern (supports up to 4-5 levels deep)

### Filename-to-JSON Mapping Rules

1. **Parent Identification**:
   - `sequence_1_sub_01.png` is a child of `sequence_1.png`
   - `sequence_1_sub_01_sub_05.png` is a child of `sequence_1_sub_01.png`

2. **JSON Construction**:
   - Find the parent Step Object in your JSON
   - Place the child Step Object inside the parent's `substeps` array
   - **Do not flatten the structure** - JSON nesting depth must match filename nesting depth

## 3. Pre-processing: Sort and Group

**CRITICAL FIRST STEP**: Before extracting any data:

1. **Sort by filename**: Order screenshots by filename to maintain sequence order
2. **Group by synthesis**: Look at the top right corner to identify which synthesis each belongs to
3. **Identify step count**: Check the "X/N" format in bottom right corner for total expected steps
4. **Report missing steps**: If gaps exist, report: `MISSING: steps X, Y, Z (expected N total)`

**IMPORTANT**: The `sequence` array always starts with `step_id: "1"`. Even if screenshots show steps 18-25, your first main step should be `step_id: "1"`.

## 4. JSON Structure

### Schema

```json
{
    "$schema": "../schema.json",
    "meta": {
        "id": "[molecule-author-year in lowercase with hyphens]",
        "molecule_name": "[Full molecule name from header]",
        "class": "[Alkaloid|Terpene|Pharmaceutical|Prostaglandin|Other]",
        "author": "[Author, Initials]",
        "year": 2024,
        "journal": "???",
        "doi": "???",
        "source_url": "[Extract from FINAL step of main sequence]"
    },
    "sequence": [
        // List of Step Objects, always starting with step_id "1"
    ]
}
```

### Step Object (Recursive)

Each step in `sequence` (and nested `substeps`) must have:

```json
{
    "step_id": "1",              // String: "1", "1.1", "1.1.1", "1.1.1.1"
    "reaction_type": "...",      // Type of reaction (e.g., "Oxidation", "Aldol")
    "reagents": "...",           // Text reagents (labels only, NOT drawn structures)
    "reagent_smiles": "...",     // SMILES for drawn reagent structures
    "reagent_split_by_plus": false,  // true if reagents shown with "+" between them
    "conditions": "...",         // Solvent, temp, time
    "yield": "...",              // Percentage if shown
    "reactant_smiles": "...",    // SMILES for LEFT structure
    "reactant_split_by_plus": false, // true if multiple reactants with "+"
    "product_smiles": "...",     // SMILES for RIGHT structure
    "product_split_by_plus": false,  // true if multiple products with "+"
    "notes": "...",              // What the transformation accomplishes
    "substeps": []               // Array of Step Objects (empty if no substeps)
}
```

### Field Descriptions

- **step_id**: String identifier matching hierarchy depth ("2", "2.1", "2.1.3", "2.1.3.1")
- **reagents**: Text names of reagents shown as labels (e.g., "TBDPSOTf, 2,6-lutidine"). Exclude drawn structures.
- **reagent_smiles**: SMILES for reagents shown as drawn molecular structures. Use dot notation for multiple (e.g., "CCO.CC(=O)O"). Empty string if none drawn. A reagent appears in EITHER `reagents` OR `reagent_smiles`, never both.
- **reactant_smiles**: SMILES for LEFT structure(s). Use dot notation for multiple reactants.
- **product_smiles**: SMILES for RIGHT structure(s). Use dot notation for multiple products.
- **\*_split_by_plus**: Set to `true` if structures shown with "+" symbol between them, `false` if side-by-side. Omit if only one structure.

## 5. SMILES Generation Rules

- Carefully analyze each 2D structure
- Include stereochemistry where shown (use `@`, `@@`, `/`, `\`)
- **Verify continuity**: Product of step N should match reactant of step N+1
- **Abbreviations**: Use ANY abbreviation for protecting groups by enclosing in square brackets (must start with uppercase). Examples: `[OEt]`, `[OMe]`, `[OAc]`, `[OBz]`, `[Ph]`, `[Bn]`, `[TBDPS]`, `[TBS]`, `[TIPS]`, `[TMS]`, `[PMB]`, `[Boc]`, `[Fmoc]`, `[Cbz]`, `[Ts]`, `[Ns]`, `[Bz]`, `[Ac]`
- If shown abbreviated in screenshot, keep abbreviated. If drawn out, do not abbreviate.

## 6. Source URL Extraction

**IMPORTANT**: The `source_url` in the `meta` object should be extracted from the **final step of the main sequence** (the last `sequence_X.png` file, not substeps). Look for any URL or citation reference displayed in that screenshot.

## 7. Output Format Example

Input files:
- `sequence_1.png`
- `sequence_2.png`
- `sequence_2_sub_01.png`
- `sequence_2_sub_01_sub_01.png`
- `sequence_2_sub_02.png`

Output JSON:

```json
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
        "source_url": "https://example.com/synthesis"
    },
    "sequence": [
        {
            "step_id": "1",
            "reaction_type": "Deprotection",
            "reagents": "LiOH*H2O",
            "reagent_smiles": "",
            "conditions": "MeOH, 23C",
            "yield": "89%",
            "reactant_smiles": "C#CCN(C1C=CCC(OC(=O)c2ccccc2)C1)S(=O)(=O)c3ccccc3[N+](=O)[O-]",
            "product_smiles": "C#CCN(C1C=CCC(O)C1)S(=O)(=O)c2ccccc2[N+](=O)[O-]",
            "notes": "Conversion of benzoate ester to alcohol",
            "substeps": []
        },
        {
            "step_id": "2",
            "reaction_type": "Multi-step transformation",
            "reagents": "",
            "reagent_smiles": "",
            "conditions": "",
            "yield": "93%",
            "reactant_smiles": "C#CCN(C1C=CCC(O)C1)S(=O)(=O)c2ccccc2[N+](=O)[O-]",
            "product_smiles": "C#CCN(C1=CC=CC(O[Si](C(C)(C)C)(c2ccccc2)c3ccccc3)=C1)S(=O)(=O)c4ccccc4[N+](=O)[O-]",
            "notes": "Oxidation followed by silyl enol ether formation",
            "substeps": [
                {
                    "step_id": "2.1",
                    "reaction_type": "Oxidation",
                    "reagents": "PCC",
                    "reagent_smiles": "",
                    "conditions": "CH2Cl2, 23C",
                    "yield": "",
                    "reactant_smiles": "C#CCN(C1C=CCC(O)C1)S(=O)(=O)c2ccccc2[N+](=O)[O-]",
                    "product_smiles": "C#CCN(C1C=CCC(=O)C1)S(=O)(=O)c2ccccc2[N+](=O)[O-]",
                    "notes": "Alcohol to ketone",
                    "substeps": [
                        {
                            "step_id": "2.1.1",
                            "reaction_type": "Workup",
                            "reagents": "Na2SO4",
                            "reagent_smiles": "",
                            "conditions": "rt",
                            "yield": "",
                            "reactant_smiles": "...",
                            "product_smiles": "...",
                            "notes": "Drying step",
                            "substeps": []
                        }
                    ]
                },
                {
                    "step_id": "2.2",
                    "reaction_type": "Silyl Enol Ether Formation",
                    "reagents": "TBDPSOTf, 2,6-lutidine",
                    "reagent_smiles": "",
                    "conditions": "CH2Cl2, -78C to 23C",
                    "yield": "88%",
                    "reactant_smiles": "C#CCN(C1C=CCC(=O)C1)S(=O)(=O)c2ccccc2[N+](=O)[O-]",
                    "product_smiles": "C#CCN(C1=CC=CC(O[Si](C(C)(C)C)(c2ccccc2)c3ccccc3)=C1)S(=O)(=O)c4ccccc4[N+](=O)[O-]",
                    "notes": "Ketone to OTBDPS enol ether",
                    "substeps": []
                }
            ]
        }
    ]
}
```

## 8. Quality Checklist

Before submitting, verify:
- [ ] Screenshots sorted by filename
- [ ] Screenshots grouped correctly by synthesis (same molecule name/author/year)
- [ ] All main steps captured (no gaps in step numbers)
- [ ] **Sequence starts with step_id "1"**
- [ ] All substeps nested under correct parents based on filename hierarchy
- [ ] All SMILES are chemically valid
- [ ] Product of step N = Reactant of step N+1
- [ ] Reagents match what's shown (text in `reagents`, drawn in `reagent_smiles`)
- [ ] Yields captured where visible
- [ ] Reaction types correctly identified
- [ ] **Source URL extracted from final main step**
- [ ] JSON is valid and properly nested

## 9. Missing Steps

If any steps are missing from the screenshots, report them:

```
MISSING STEPS: [Synthesis Name] - steps [X, Y, Z] missing out of [total] steps
```

Use the "X/N" format from screenshots to determine expected total.
