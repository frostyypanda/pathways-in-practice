# SMILES Validation & Fix Scripts

Tools for validating and fixing SMILES strings in the synthesis_steps database.

## Scripts

### validate-smiles.js

Validates all SMILES in the database using the custom smiles-drawer fork.

```bash
cd scripts/smiles-validation
npm install
node validate-smiles.js
node validate-smiles.js --dry-run    # Just count rows, don't validate
```

**Output:** `output/broken_smiles_{timestamp}.json`

### fix-smiles.js

Reads broken SMILES from validation output, applies safe regex fixes, validates results, and updates the database.

```bash
node fix-smiles.js                              # Use latest broken_smiles file
node fix-smiles.js broken_smiles_2025-12-17.json  # Use specific file
node fix-smiles.js --dry-run                    # Preview fixes, no DB update
```

**Output:**
- `output/fix_report_{timestamp}.json` - Details of what was fixed
- `output/needs_review_{timestamp}.json` - Items that still need manual review

## Safe Regex Fixes Applied

The fix script applies these deterministic replacements:

| Pattern | Replacement | Example |
|---------|-------------|---------|
| `OSi` outside brackets | `[OSi]` | `OSi(C)(C)C` → `[OSi](C)(C)C` |
| `ONa` outside brackets | `[ONa]` | `CONa` → `C[ONa]` |
| `OMg` outside brackets | `[OMg]` | `COMgBr` → `C[OMg]Br` |
| `Si` outside brackets | `[Si]` | `CSi(C)` → `C[Si](C)` |
| `Na` outside brackets | `[Na]` | `CNa` → `C[Na]` |
| `Mg` outside brackets | `[Mg]` | `CMgBr` → `C[Mg]Br` |
| Terminal `H` | `[H]` | `C#CH` → `C#C[H]` |
| `}` typo | `]` | `[C@@H}` → `[C@@H]` |

## What We DON'T Fix

The custom smiles-drawer library (`public/smiles-drawer.min.js`) already supports these abbreviations, so we leave them as-is:

- `[TIPS]`, `[OTIPS]`, `[TBS]`, `[OTBS]`, `[TMS]`, `[OTMS]`
- `[Ph]`, `[Bn]`, `[OBn]`, `[BnO]`
- `[OtBu]`, `[OAc]`, `[Ac]`, `[OMOM]`, `[MOM]`, `[Tr]`
- Any other `[...]` abbreviations

**Note:** `[tBu]` alone is NOT supported (only `[OtBu]`). See "Known Unsupported Abbreviations" below.

## Database

- **Table:** `synthesis_steps`
- **Fields checked:** `corrected_reactant_smiles`, `corrected_reagent_smiles`, `corrected_product_smiles`
- **Connection:** Uses `.env` from `smiles-extractor/` directory

## Testing

### Test the Renderer

Use the web-based SMILES renderer to test individual SMILES strings:

```
https://pathwayspractice.org/render
```

Paste any SMILES to see if it renders correctly. The page creates a fresh renderer instance on each change.

### Test Validation

```bash
# Run validation on full database
node validate-smiles.js

# Check the output file for broken SMILES
cat output/broken_smiles_*.json | head -100
```

### Test Fixes (Dry Run)

```bash
# Preview what would be fixed without modifying database
node fix-smiles.js --dry-run

# Check the report
cat output/fix_report_*.json | head -100
```

### Verify Fixes After Running

```bash
# Re-run validation to confirm fixes worked
node validate-smiles.js

# Compare broken count before/after
```

## Workflow

1. **Validate** → Run `validate-smiles.js` to find broken SMILES
2. **Preview** → Run `fix-smiles.js --dry-run` to see what can be fixed
3. **Fix** → Run `fix-smiles.js` to apply fixes to database
4. **Verify** → Run `validate-smiles.js` again to confirm improvement
5. **Review** → Check `needs_review_*.json` for remaining issues

## Notes

- The smiles-drawer library is loaded from `public/smiles-drawer.min.js`
- This is a custom fork with abbreviation support
- Truncated SMILES (ending mid-string) cannot be auto-fixed
- Items in `needs_review` may need LLM assistance or manual correction

## smiles-drawer Source Code

The custom smiles-drawer fork source code is located at:
```
E:\repos\djeca\pathways\smilesDrawer
```

To add new abbreviations (like `[tBu]`), modify the source and rebuild.

## Custom Abbreviation Support

The smiles-drawer library was modified to support ANY abbreviation in square brackets that:
- Starts with any letter (uppercase or lowercase)
- Contains letters and numbers

**Examples that work:**
- `[tBu]`, `[iPr]`, `[sBu]` ✅
- `[TBS]`, `[OTBS]`, `[Boc]`, `[Cbz]` ✅
- `[anything123]` ✅

**Limitation:** Abbreviations starting with aromatic symbols (`b`, `c`, `n`, `o`, `p`, `s`) won't work:
- `[nBu]` ❌ - `n` is parsed as aromatic nitrogen first
- `[oBu]` ❌ - `o` is parsed as aromatic oxygen first

This is acceptable since `[nBu]` (n-butyl) is typically written as a full carbon chain anyway.
