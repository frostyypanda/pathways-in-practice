# SMILES Extractor - Model Evaluation Report

**Test Date:** 2025-12-15
**Test Image:** Aberrarone (Jia 2023), Step 1
**Task:** Validate and correct SMILES from chemistry screenshot

## Test Setup

**Input SMILES from Database:**
- Reactant (conf 0.96): `C[C@H](CO)C(=O)OC`
- Reagent (conf 0.69): `CC(C)(C)[Si]...` (with massive junk fragments)
- Product (conf 0.98): `C[C@H](CO[Si](C1=CC=CC=C1)(C2=CC=CC=C2)C(C)(C)C)C(=O)OC`

**Expected Corrections:**
1. Reactant: Keep as-is or minor normalization
2. Reagent: Remove all junk, extract text labels (TBDPSCl, imidazole, CH2Cl2)
3. Product: Apply `[OTBDPS]` abbreviation to match screenshot

---

## Results Summary (60,000 Steps Cost Projection)

| Model | Cost/Call | 60K Cost | Quality | Abbreviation | Verdict |
|-------|-----------|----------|---------|--------------|---------|
| **gemini-2.5-flash-lite** | $0.0003 | **$15** | ⭐⭐⭐ | ❌ Expanded | Cheapest, structure errors |
| **gpt-5-nano** | $0.0021 | **$127** | ⭐⭐ | ❌ Wrong | Cheap but errors |
| **gemini-2.5-flash** | $0.0054 | **$324** | ⭐⭐⭐⭐ | ✅ Correct | **RECOMMENDED** |
| **gpt-5.1** | $0.0055 | **$330** | ⭐⭐⭐⭐ | ✅ Correct | Excellent |
| **gpt-5-mini** | $0.0058 | **$345** | ⭐⭐⭐ | ❌ Wrong | Redundant O error |
| **gpt-4o-mini** | $0.0060 | **$361** | ⭐⭐ | ❌ Expanded | Poor value |
| **gpt-4o** | $0.0062 | **$373** | ⭐⭐⭐ | ❌ Expanded | Good chemistry |
| **claude-haiku-4.5** | $0.0090 | **$540** | ⭐⭐⭐⭐⭐ | ✅ Correct | Best detailed analysis |
| **claude-sonnet-4.5** | $0.0191 | **$1,146** | ⭐⭐⭐⭐ | ✅ Correct | Changed structure |
| **gemini-3-pro-preview** | $0.0198 | **$1,188** | ⭐⭐⭐⭐⭐ | ✅ Correct | Best quality |
| **gpt-5** | $0.0400 | **$2,402** | ⭐⭐⭐⭐⭐ | ✅ Correct | Too expensive |

---

## Detailed Model Analysis

### GPT-5 Series

#### gpt-5-nano
**Cost:** $0.002111 | **60K:** $127

```json
{
  "reactant_smiles": "C[C@H](CO)C(=O)OC",
  "product_smiles": "C[C@H](CO[OTBDPS])(C(=O)OC)",
  "reagents": "TBDPSCl, imidazole",
  "conditions": "CH2Cl2, room temperature"
}
```

**Assessment:**
- ✅ Removed junk from reagent
- ✅ Extracted reagents correctly
- ❌ **WRONG:** Product has `CO[OTBDPS]` = C-O-O-TBDPS (redundant oxygen!)
- ❌ Extra parentheses in SMILES
- ⚠️ Said "secondary alcohol" but it's a primary alcohol

**Verdict:** Cheap but makes chemistry errors. Not reliable.

---

#### gpt-5-mini
**Cost:** $0.005752 | **60K:** $345

```json
{
  "reactant_smiles": "C[C@H](CO)C(=O)OC",
  "product_smiles": "C[C@H](CO[OTBDPS])C(=O)OC",
  "reagents": "TBDPSCl, imidazole",
  "conditions": "CH2Cl2"
}
```

**Assessment:**
- ✅ Removed junk from reagent
- ✅ Separated reagents/conditions correctly
- ❌ **WRONG:** Same redundant oxygen error `CO[OTBDPS]`
- The O is already in `[OTBDPS]`, so `CO[OTBDPS]` = C-O-OTBDPS

**Verdict:** Same error as nano. The `[OTBDPS]` already includes the O.

---

#### gpt-5.1
**Cost:** $0.005505 | **60K:** $330

```json
{
  "reactant_smiles": "C[C@H](CO)C(=O)OC",
  "product_smiles": "C[C@H](CO[TBDPS])C(=O)OC",
  "reagents": "TBDPSCl, imidazole, CH2Cl2"
}
```

**Assessment:**
- ✅ Removed junk from reagent
- ✅ **CORRECT:** Uses `CO[TBDPS]` (O from original, TBDPS abbreviation)
- ✅ Clean output format
- ⚠️ Put solvent in reagents (minor)

**Verdict:** Excellent! Understood that `[TBDPS]` doesn't include O.

---

#### gpt-5
**Cost:** $0.040035 | **60K:** $2,402

```json
{
  "reactant_smiles": "C[C@H](CO)C(=O)[OMe]",
  "product_smiles": "C[C@H](C[OTBDPS])C(=O)[OMe]",
  "reagents": "TBDPSCl, imidazole",
  "conditions": "CH2Cl2"
}
```

**Assessment:**
- ✅ Removed junk from reagent
- ✅ Applied `[OTBDPS]` correctly (no redundant O)
- ✅ Also applied `[OMe]` abbreviation for methyl ester
- ✅ Separated reagents/conditions correctly
- ❌ Very expensive (8x gpt-5.1)

**Verdict:** Best GPT model quality, but cost prohibitive.

---

### Gemini Series

#### gemini-2.5-flash-lite
**Cost:** $0.000254 | **60K:** $15

```json
{
  "reactant_smiles": "COC(=O)[C@H](C)CO",
  "product_smiles": "COC(=O)[C@H](C)CO[Si](C(C)(C)C)(C(C)(C)C)C1=CC=CC=C1"
}
```

**Assessment:**
- ✅ Removed junk, canonical SMILES
- ❌ Did NOT apply abbreviation
- ❌ **WRONG TBDPS:** Only has ONE phenyl ring, should have TWO
- The correct TBDPS is `[Si](c1ccccc1)(c1ccccc1)C(C)(C)C`

**Verdict:** Cheapest but wrong chemistry structure.

---

#### gemini-2.5-flash
**Cost:** $0.005393 | **60K:** $324

```json
{
  "reactant_smiles": "C[C@H](CO)C(=O)OC",
  "product_smiles": "C[C@H](C[OTBDPS])C(=O)OC",
  "reagents": "TBDPSCl, imidazole",
  "conditions": "CH2Cl2"
}
```

**Assessment:**
- ✅ Removed junk from reagent
- ✅ **CORRECT:** Applied `[OTBDPS]` properly
- ✅ Separated reagents/conditions
- ✅ Consistent, clean output

**Verdict:** Best value. Correct chemistry at reasonable cost.

---

#### gemini-3-pro-preview
**Cost:** $0.019800 | **60K:** $1,188

```json
{
  "reactant_smiles": "C[C@H](CO)C(=O)OC",
  "product_smiles": "C[C@H](C[OTBDPS])C(=O)OC",
  "reagents": "TBDPSCl, imidazole",
  "conditions": "CH2Cl2"
}
```

**Assessment:**
- ✅ Everything correct
- ✅ Detailed stereochemistry reasoning
- ✅ Most thorough analysis
- ❌ 4x more expensive than flash

**Verdict:** Best quality, use for complex/critical cases.

---

### Anthropic Claude Series

#### claude-haiku-4.5
**Cost:** $0.008998 | **60K:** $540

```json
{
  "reactant_smiles": "C[C@H](CO)C(=O)OC",
  "reagent_smiles": "CC(C)(C)[Si](C(C)(C)C)(C(C)(C)C)Cl",
  "product_smiles": "C[C@H](CO[TBDPS])C(=O)OC",
  "reagents": "TBDPSCl, imidazole",
  "conditions": "CH₂Cl₂"
}
```

**Assessment:**
- ✅ Removed junk (noted "80+ ethyl/propyl fragments")
- ✅ **CORRECT:** Uses `CO[TBDPS]` (O from original, TBDPS abbreviation)
- ✅ Kept TBDPSCl SMILES in reagent_smiles field
- ✅ Most detailed analysis with quality checklist
- ✅ Preserved original reactant SMILES

**Verdict:** Excellent! Best documentation and reasoning. Good value at $540/60K.

---

#### claude-sonnet-4.5
**Cost:** $0.019104 | **60K:** $1,146

```json
{
  "reactant_smiles": "COC(=O)C[C@@H](C)O",
  "reagent_smiles": "",
  "product_smiles": "COC(=O)C[C@@H](C)[OTBDPS]",
  "reagents": "TBDPSCl, imidazole",
  "conditions": "CH2Cl2"
}
```

**Assessment:**
- ✅ Removed junk from reagent
- ✅ Applied `[OTBDPS]` correctly
- ⚠️ **Changed reactant structure significantly** (reordered, different connectivity)
- ⚠️ Changed stereochemistry from `@` to `@@`
- ⚠️ Claims stereocenter is at wrong position (debatable)

**Verdict:** Good abbreviation handling but makes structural changes that may not be correct.

---

### OpenAI GPT-4 Series

#### gpt-4o-mini
**Cost:** $0.006025 | **60K:** $361

```json
{
  "product_smiles": "C[C@H](CO[Si](C1=CC=CC=C1)(C2=CC=CC=C2)C(C)(C)C)C(=O)OC"
}
```

**Assessment:**
- ❌ Did NOT apply abbreviation
- ❌ Put solvent in reagents
- ⚠️ Huge token usage (38K input!)

**Verdict:** Poor value. Expensive with no abbreviation support.

---

#### gpt-4o
**Cost:** $0.006220 | **60K:** $373

```json
{
  "reactant_smiles": "COC(=O)[C@@H](CO)C",
  "product_smiles": "COC(=O)[C@@H](CO[Si](C(C)(C)C)(C1=CC=CC=C1)C2=CC=CC=C2)C"
}
```

**Assessment:**
- ✅ Correct TBDPS structure (2 phenyls)
- ❌ Did NOT apply abbreviation
- ⚠️ Changed stereochemistry `@` → `@@`

**Verdict:** Good chemistry but doesn't follow instructions.

---

## Abbreviation Handling Summary

The prompt asks to use `[OTBDPS]` when the screenshot shows "OTBDPS".

| Model | Approach | Correct? |
|-------|----------|----------|
| gpt-5 | `C[OTBDPS]` | ✅ Yes |
| gpt-5.1 | `CO[TBDPS]` | ✅ Yes (alternative) |
| gemini-2.5-flash | `C[OTBDPS]` | ✅ Yes |
| gemini-3-pro | `C[OTBDPS]` | ✅ Yes |
| claude-haiku-4.5 | `CO[TBDPS]` | ✅ Yes (alternative) |
| claude-sonnet-4.5 | `C[OTBDPS]` | ✅ Yes |
| gpt-5-mini | `CO[OTBDPS]` | ❌ No (double O) |
| gpt-5-nano | `CO[OTBDPS]` | ❌ No (double O) |
| Others | Full expansion | ❌ No |

---

## Recommendations

### Best Value (60K steps): **gemini-2.5-flash** or **gpt-5.1**
- Cost: $324 - $330
- Quality: ⭐⭐⭐⭐
- Correct abbreviations, clean output

### Best Documentation: **claude-haiku-4.5**
- Cost: $540
- Quality: ⭐⭐⭐⭐⭐
- Most detailed analysis, quality checklist included

### Best Quality: **gemini-3-pro-preview** or **gpt-5**
- Cost: $1,188 - $2,402
- Quality: ⭐⭐⭐⭐⭐
- For critical/complex structures

### Budget Option: **gemini-2.5-flash-lite**
- Cost: $15
- Quality: ⭐⭐⭐
- Warning: Makes chemistry structure errors

### Avoid:
- **gpt-5-mini/nano**: Redundant oxygen errors (`CO[OTBDPS]`)
- **gpt-4o-mini**: Expensive, poor instruction following
- **gpt-4o**: Changes stereochemistry without justification
- **claude-sonnet-4.5**: Changes reactant structure significantly

---

## Test Commands

```bash
# Recommended - Best Value
python extract.py --synthesis-id 3398 --step 1 --model gemini-2.5-flash --base-path "/mnt/d/chemistry-scraped" --no-cache
python extract.py --synthesis-id 3398 --step 1 --model gpt-5.1 --base-path "/mnt/d/chemistry-scraped"

# Best Documentation
python extract.py --synthesis-id 3398 --step 1 --model claude-haiku-4.5 --base-path "/mnt/d/chemistry-scraped"

# Budget
python extract.py --synthesis-id 3398 --step 1 --model gemini-2.5-flash-lite --base-path "/mnt/d/chemistry-scraped" --no-cache

# Premium
python extract.py --synthesis-id 3398 --step 1 --model gemini-3-pro-preview --base-path "/mnt/d/chemistry-scraped" --no-cache
python extract.py --synthesis-id 3398 --step 1 --model gpt-5 --base-path "/mnt/d/chemistry-scraped"

# Claude series
python extract.py --synthesis-id 3398 --step 1 --model claude-haiku-4.5 --base-path "/mnt/d/chemistry-scraped"
python extract.py --synthesis-id 3398 --step 1 --model claude-sonnet-4.5 --base-path "/mnt/d/chemistry-scraped"
```
