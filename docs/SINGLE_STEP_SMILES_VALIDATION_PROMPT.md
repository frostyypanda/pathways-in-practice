# Single Step SMILES Validation Prompt

You are validating and correcting SMILES data for a single reaction step by comparing against a screenshot.

## Input

You will receive:
1. **Screenshot**: One reaction step showing LEFT (reactant) → CENTER (reagents/conditions) → RIGHT (product)
2. **Current SMILES** (to validate):
   ```json
   {
     "reactant": "...",
     "reagent": "...",
     "product": "..."
   }
   ```
3. **Previous step product SMILES** (optional): For continuity check (should match current reactant)
4. **Next step reactant SMILES** (optional): For continuity check (should match current product)

## Your Task

Validate, filter, and correct the provided SMILES to match what's shown in the screenshot.

## Step 1: Visual Validation

For each structure (reactant, product, any drawn reagents):
1. Count heavy atoms - does the SMILES match?
2. Verify ring systems match
3. Check functional groups are correct
4. Confirm stereochemistry where shown (use `@`, `@@`, `/`, `\`)

## Step 2: Filter Junk SMILES

The extraction often produces artifacts. Remove:

| Pattern | Example | Action |
|---------|---------|--------|
| Single atoms/small fragments | `.C`, `.N`, `.CI` | Remove |
| Repeated fragments | `CC.CC.CC.CC` | Remove all but one if real |
| Long unbranched chains | `CCCCCCCCCCC` | Remove unless in structure |
| Wrong metal ions | `[Tb+3]` when image shows NaNO₂ | Remove |
| Random counterions | Salts not in the reaction | Remove |

**Example**:
```
Input:  CC1=CN=C(C=C1)C2=CC=C(C)C=N2.CCCCCCCCCCC.CCCCCC
Output: CC1=CN=C(C=C1)C2=CC=C(C)C=N2
```

## Step 3: Handle Reagents

- **Text labels** (e.g., "Pd/C, NaOH") → put in `reagents`, leave `reagent_smiles` empty
- **Drawn structures** → validate and put in `reagent_smiles`
- If input `reagent` SMILES is all junk → discard entirely

## Step 4: Apply Abbreviations

If a group is **abbreviated in the screenshot** but **expanded in SMILES**, convert to abbreviated form:

| Category | Abbreviations |
|----------|---------------|
| Protecting groups | `[TBDPS]`, `[TBS]`, `[TIPS]`, `[TMS]`, `[PMB]`, `[Boc]`, `[Fmoc]`, `[Cbz]`, `[Tr]` |
| O-groups | `[OMe]`, `[OEt]`, `[OAc]`, `[OBz]`, `[OBn]`, `[OTBDPS]`, `[OTBS]` |
| Common | `[Ph]`, `[Bn]`, `[Ts]`, `[Ns]`, `[Bz]`, `[Ac]`, `[Piv]` |

**Rule**: Match the screenshot's representation exactly.
- Abbreviated in screenshot → use abbreviation
- Drawn out fully → keep expanded SMILES

## Step 5: Continuity Check

If provided:
- **Previous product** should match **current reactant** (or be very similar)
- **Current product** should match **next reactant**

Flag any mismatches - this helps identify which step has the error.

## Output Format

```json
{
  "reactant_smiles": "validated SMILES",
  "reagent_smiles": "validated SMILES or empty string",
  "product_smiles": "validated SMILES",
  "reagents": "text reagent labels",
  "conditions": "solvent, temp, time",
  "yield": "XX%" or "",
  "reaction_type": "e.g., Oxidation, Aldol, etc.",
  "notes": "brief description of transformation",
  "continuity": {
    "matches_previous": true/false/null,
    "matches_next": true/false/null,
    "issues": "description if any mismatch"
  },
  "corrections_made": [
    "Removed junk fragment .CCCCCC from product",
    "Applied [OTBDPS] abbreviation to match screenshot"
  ]
}
```

## Quality Checklist

Before responding, verify:
- [ ] SMILES atom count matches drawn structure
- [ ] Ring systems correct
- [ ] Functional groups correct
- [ ] Junk fragments removed
- [ ] Abbreviations match screenshot
- [ ] Continuity with adjacent steps checked
- [ ] Text reagents vs drawn reagents distinguished
