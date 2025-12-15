# SMILES Extractor - Detailed Model Comparison

**Test Date:** 2025-12-15
**Synthesis:** Aberrarone (Jia 2023), ID: 3398
**Steps Tested:** Step 1 (simple) and Step 12 (complex gold-catalyzed cyclization)

---

## gemini-2.5-flash-lite

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 1,752 | 262 | 2,014 | **$15** | `COC(=O)[C@H](C)CO` | `COC(=O)[C@H](C)CO[Si](C(C)(C)C)(C(C)(C)C)C1=CC=CC=C1` | ⭐⭐ Wrong TBDPS (1 phenyl instead of 2) |
| 12 | 1,725 | 420 | 2,145 | **$19** | `C=CC(O[C@@H](C)C(C)(C)...` (made up) | `C[C@@H](C)CC1=C(C(=O)OC)C2CC3...` (made up) | ⭐ Completely wrong structure |

**Verdict:** Cheapest but unreliable. Makes chemistry errors on both simple and complex structures.

---

## gpt-5-nano

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 2,803 | 5,161 | 7,964 | **$127** | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[OTBDPS])(C(=O)OC)` | ⭐⭐ Double O error (`CO[OTBDPS]`) |
| 12 | 2,758 | 7,943 | 10,701 | **$174** | (kept original) | (kept original) | ⭐⭐ Confused, asked for clarification |

**Verdict:** Cheap but makes consistent errors. Gets confused on complex structures.

---

## gemini-2.5-flash

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 1,752 | 1,978 | 3,730 | **$324** | `C[C@H](CO)C(=O)OC` | `C[C@H](C[OTBDPS])C(=O)OC` | ⭐⭐⭐⭐ Correct abbreviation |
| 12 | 1,725 | 8,127 | 9,852 | **$1,245** | `C=C[C@@H](...[OAc])[PMBO]` | `C[C@@H](...[PMBO])[OAc])C=O` | ⭐⭐⭐⭐⭐ Correct + built catalyst SMILES |

**Verdict:** Best overall. Handles both simple and complex correctly. Cost increases 4x on complex due to detailed reasoning output.

---

## gpt-5.1

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 2,332 | 259 | 2,591 | **$330** | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[TBDPS])C(=O)OC` | ⭐⭐⭐⭐ Correct (`CO[TBDPS]`) |
| 12 | 2,287 | 383 | 2,670 | **$401** | `C=C[C@@H](...O[OAc])O[PMB]` | `C[C@@H](...O[PMB])O[OAc])C=O` | ⭐⭐⭐ Double O error (`O[OAc]`, `O[PMB]`) |

**Verdict:** Great for simple structures. Makes double-O errors on complex structures with multiple protecting groups.

---

## gpt-5-mini

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 2,527 | 2,794 | 5,321 | **$345** | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[OTBDPS])C(=O)OC` | ⭐⭐⭐ Double O error |
| 12 | 2,482 | 3,437 | 5,919 | **$391** | (kept original, expanded PMB) | (kept original, expanded PMB) | ⭐⭐⭐ No abbreviations applied |

**Verdict:** Consistent double-O error on abbreviations. Does not apply abbreviations on complex structures.

---

## gpt-4o-mini

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 38,258 | 240 | 38,498 | **$361** | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[Si](...))C(=O)OC` | ⭐⭐ No abbreviation applied |
| 12 | 38,213 | 327 | 38,540 | **$356** | (kept original) | (kept original) | ⭐ Kept junk reagents, no corrections |

**Verdict:** Poor value. Huge input tokens (38K for image), doesn't follow abbreviation instructions, kept junk on step 12.

---

## gpt-4o

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 2,528 | 214 | 2,742 | **$373** | `COC(=O)[C@@H](CO)C` | `COC(=O)[C@@H](CO[Si](...))C` | ⭐⭐⭐ Changed stereochemistry @ to @@ |
| 12 | 2,483 | 303 | 2,786 | **$554** | (kept original) | (kept original) | ⭐⭐⭐ Basic, no abbreviations |

**Verdict:** Good chemistry understanding but doesn't apply abbreviations. Changed stereochemistry without clear justification.

---

## claude-haiku-4.5

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 2,873 | 1,225 | 4,098 | **$540** | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[TBDPS])C(=O)OC` | ⭐⭐⭐⭐⭐ Best documentation, correct |
| 12 | 2,830 | 1,140 | 3,970 | **$512** | (kept original, validated) | (kept original, validated) | ⭐⭐⭐⭐ Validated structure, no abbrev |

**Verdict:** Best documentation and analysis. Correct on simple, validates but doesn't abbreviate on complex. Includes quality checklist.

---

## claude-sonnet-4.5

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 2,873 | 634 | 3,507 | **$1,146** | `COC(=O)C[C@@H](C)O` | `COC(=O)C[C@@H](C)[OTBDPS]` | ⭐⭐⭐⭐ Changed structure significantly |
| 12 | 2,830 | 905 | 3,735 | **$1,382** | (rewrote structure with `[OPMB]`) | (rewrote structure with `[OPMB]`, `[OAc]`) | ⭐⭐⭐⭐ Applied abbreviations, rewrote |

**Verdict:** Applies abbreviations correctly but aggressively rewrites structures. May introduce errors by changing too much.

---

## gemini-3-pro-preview

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 2,594 | 1,401 | 3,995 | **$1,188** | `C[C@H](CO)C(=O)OC` | `C[C@H](C[OTBDPS])C(=O)OC` | ⭐⭐⭐⭐⭐ Best reasoning, correct |
| 12 | 2,567 | 8,664 | 11,231 | **$6,414** | `...O[Ac])O[PMB]` | `...[C@@H]23)O[PMB])O[Ac]...` | ⭐⭐⭐⭐⭐ Built full catalyst SMILES |

**Verdict:** Best quality and reasoning. Very expensive on complex structures due to 8K+ output tokens.

---

## gpt-5

| Step | Input | Output | Total | 60K Cost | Reactant SMILES | Product SMILES | Quality |
|------|-------|--------|-------|----------|-----------------|----------------|---------|
| 1 | 2,332 | 3,966 | 6,298 | **$2,402** | `C[C@H](CO)C(=O)[OMe]` | `C[C@H](C[OTBDPS])C(=O)[OMe]` | ⭐⭐⭐⭐⭐ Also applied [OMe] |
| 12 | 2,287 | 4,959 | 7,246 | **$2,868** | `...[OAc])[PMBO]` | `...[PMBO])[OAc])C=O` | ⭐⭐⭐⭐⭐ Correct abbreviations |

**Verdict:** Premium quality. Applies all abbreviations correctly including [OMe]. Very expensive.

---

## Summary Tables

### Cost Comparison (60K steps)

| Model | Step 1 | Step 12 | Average |
|-------|--------|---------|---------|
| gemini-2.5-flash-lite | $15 | $19 | $17 |
| gpt-5-nano | $127 | $174 | $151 |
| gemini-2.5-flash | $324 | $1,245 | $785 |
| gpt-5.1 | $330 | $401 | $366 |
| gpt-5-mini | $345 | $391 | $368 |
| gpt-4o-mini | $361 | $356 | $359 |
| gpt-4o | $373 | $554 | $464 |
| claude-haiku-4.5 | $540 | $512 | $526 |
| claude-sonnet-4.5 | $1,146 | $1,382 | $1,264 |
| gemini-3-pro-preview | $1,188 | $6,414 | $3,801 |
| gpt-5 | $2,402 | $2,868 | $2,635 |

### Quality Matrix (with 60K Costs)

| Model | Step 1 Quality | Step 1 (60K) | Step 12 Quality | Step 12 (60K) | Abbreviations |
|-------|----------------|--------------|-----------------|---------------|---------------|
| gemini-2.5-flash-lite | ⭐⭐ Wrong TBDPS | $18 | ⭐ Wrong structure | $18 | ❌ |
| gpt-5-nano | ⭐⭐ Double O | $126 | ⭐⭐ Confused | $174 | ❌ Double O |
| gpt-5.1 | ⭐⭐⭐⭐ Correct | $330 | ⭐⭐⭐ Double O | $402 | ⚠️ Simple only |
| gpt-5-mini | ⭐⭐⭐ Double O | $348 | ⭐⭐⭐ No abbrev | $390 | ❌ Double O |
| gpt-4o-mini | ⭐⭐ No abbrev | $360 | ⭐ Kept junk | $354 | ❌ |
| gpt-4o | ⭐⭐⭐ Changed stereo | $372 | ⭐⭐⭐ Basic | $552 | ❌ |
| claude-haiku-4.5 | ⭐⭐⭐⭐⭐ Best docs | $540 | ⭐⭐⭐⭐ Validated | $510 | ⚠️ Simple only |
| gemini-2.5-flash | ⭐⭐⭐⭐ Correct | $324 | ⭐⭐⭐⭐⭐ Correct | $1,248 | ✅ Both |
| claude-sonnet-4.5 | ⭐⭐⭐⭐ Rewrote | $1,146 | ⭐⭐⭐⭐ Rewrote | $1,380 | ✅ Both |
| gemini-3-pro-preview | ⭐⭐⭐⭐⭐ Best | $1,188 | ⭐⭐⭐⭐⭐ Best | $6,414 | ✅ Both |
| gpt-5 | ⭐⭐⭐⭐⭐ Best | $2,400 | ⭐⭐⭐⭐⭐ Best | $2,868 | ✅ Both |

### Recommendations

| Use Case | Recommended Model | 60K Cost | Notes |
|----------|-------------------|----------|-------|
| **Simple structures only** | gpt-5.1 | $330 | Fast, correct on simple |
| **Best documentation** | claude-haiku-4.5 | $526 | Quality checklist included |
| **Best value overall** | gemini-2.5-flash | $785 avg | Handles both correctly |
| **Premium quality** | gpt-5 | $2,635 | Best abbreviations |
| **Maximum quality** | gemini-3-pro-preview | $3,801 | Best reasoning |

### Avoid

| Model | Reason |
|-------|--------|
| gemini-2.5-flash-lite | Wrong chemistry structures |
| gpt-5-nano | Gets confused, asks for help |
| gpt-5-mini | Consistent double-O errors |
| gpt-4o-mini | Keeps junk, huge token usage |
| gpt-4o | Changes stereochemistry |

---

## Smart Routing Strategy

Based on complexity metrics from input SMILES:

```python
def get_model_for_complexity(reactant_smiles, product_smiles, reagent_conf):
    complexity_score = 0

    # Length-based
    if len(reactant_smiles) > 50:
        complexity_score += 1
    if len(product_smiles) > 80:
        complexity_score += 1

    # Stereochemistry (count @ symbols)
    stereo_count = reactant_smiles.count('@') + product_smiles.count('@')
    if stereo_count > 4:
        complexity_score += 1

    # Ring systems (count digits in SMILES)
    ring_count = sum(1 for c in product_smiles if c.isdigit())
    if ring_count > 4:
        complexity_score += 1

    # Low confidence reagent = more junk to filter
    if reagent_conf < 0.75:
        complexity_score += 1

    # Route to model
    if complexity_score <= 1:
        return "gpt-5.1"           # Simple: $330/60K
    elif complexity_score <= 3:
        return "claude-haiku-4.5"  # Medium: $526/60K
    else:
        return "gemini-2.5-flash"  # Complex: $1,245/60K
```

**Estimated savings with routing:** ~50% vs using gemini-2.5-flash for everything.

---

## Complete SMILES Output (Exact Model Returns)

### Database Input (Reference)

**Step 1:**
```
reactant: C[C@H](CO)C(=O)OC
reagent:  CC(C)(C)[Si](C(C)(C)C)(C(C)(C)C)Cl.CC(C)(C)[Si](C(C)(C)C)(C(C)(C)C)Cl.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CC.CCC.CC.CC.CC.CCC.CC.CCC.CC.CC.CCC.CCC.CCC.CCC.CCC.CC.CC.CC.CCC.CCC.CC.CC.CCC.CC.CCC.CCC.CCC.CC.CC.CC.CCCC.CCC.CC.CCC.CCC.CCC.CCC
product:  C[C@H](CO[Si](C1=CC=CC=C1)(C2=CC=CC=C2)C(C)(C)C)C(=O)OC
```

**Step 12:**
```
reactant: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC
reagent:  CC(C)(C)[P@@](C1=CC=CC=C1C2=CC=CC=C2)C(C)(C)C.CC(C)(C)OC(=O)C(F)(F)F.CO[Al+]OC.C=C.C=C.C=C...
product:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O
```

---

### gemini-2.5-flash-lite

**Step 1:**
```
reactant_smiles: COC(=O)[C@H](C)CO
reagent_smiles:  (empty)
product_smiles:  COC(=O)[C@H](C)CO[Si](C(C)(C)C)(C(C)(C)C)C1=CC=CC=C1
```

**Step 12:**
```
reactant_smiles: C=CC(O[C@@H](C)C(C)(C)OC(=O)C#CC1=CC[C@H](C)[C@@H]1CC[C@H](C)C=O)C2=CC=C(C=C2)OC
reagent_smiles:  (empty)
product_smiles:  C[C@@H](C)CC1=C(C(=O)OC)C2CC3CC(C)(C)[C@@H]2C1C3[C@H]([C@@H]4[C@@H]4CC[C@@H](C)[C@H]4OCC5=CC=C(C=C5)OC)CC4OC(=O)C
```

---

### gpt-5-nano

**Step 1:**
```
reactant_smiles: C[C@H](CO)C(=O)OC
reagent_smiles:  (empty)
product_smiles:  C[C@H](CO[OTBDPS])(C(=O)OC)
```

**Step 12:**
```
reactant_smiles: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC
reagent_smiles:  (empty)
product_smiles:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O
```

---

### gemini-2.5-flash

**Step 1:**
```
reactant_smiles: C[C@H](CO)C(=O)OC
reagent_smiles:  (empty)
product_smiles:  C[C@H](C[OTBDPS])C(=O)OC
```

**Step 12:**
```
reactant_smiles: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)[OAc])[PMBO]
reagent_smiles:  [Au+]([P@@](C(C)(C)C)(C(C)(C)C)C1=CC=CC=C1C2=CC=CC=C2)(N#CC).[SbF6-]
product_smiles:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)[PMBO])[OAc])C=O
```

---

### gpt-5.1

**Step 1:**
```
reactant_smiles: C[C@H](CO)C(=O)OC
reagent_smiles:  (empty)
product_smiles:  C[C@H](CO[TBDPS])C(=O)OC
```

**Step 12:**
```
reactant_smiles: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)O[OAc])O[PMB]
reagent_smiles:  (empty)
product_smiles:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)O[PMB])O[OAc])C=O
```

---

### gpt-5-mini

**Step 1:**
```
reactant_smiles: C[C@H](CO)C(=O)OC
reagent_smiles:  (empty)
product_smiles:  C[C@H](CO[OTBDPS])C(=O)OC
```

**Step 12:**
```
reactant_smiles: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCH2c2ccc(OC)cc2
reagent_smiles:  (empty)
product_smiles:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCH2c5ccc(OC)cc5)OC(=O)C)C=O
```

---

### gpt-4o-mini

**Step 1:**
```
reactant_smiles: C[C@H](CO)C(=O)OC
reagent_smiles:  (empty)
product_smiles:  C[C@H](CO[Si](C1=CC=CC=C1)(C2=CC=CC=C2)C(C)(C)C)C(=O)OC
```

**Step 12:**
```
reactant_smiles: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC
reagent_smiles:  C(C)(C)[P@@](C1=CC=CC=C1C2=CC=CC=C2)C(C)(C)C.CC(C)(C)C(=O)C(F)(F)F.CO[Al+]OC
product_smiles:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O
```

---

### gpt-4o

**Step 1:**
```
reactant_smiles: COC(=O)[C@@H](CO)C
reagent_smiles:  (empty)
product_smiles:  COC(=O)[C@@H](CO[Si](C(C)(C)C)(C1=CC=CC=C1)C2=CC=CC=C2)C
```

**Step 12:**
```
reactant_smiles: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC
reagent_smiles:  (empty)
product_smiles:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O
```

---

### claude-haiku-4.5

**Step 1:**
```
reactant_smiles: C[C@H](CO)C(=O)OC
reagent_smiles:  CC(C)(C)[Si](C(C)(C)C)(C(C)(C)C)Cl
product_smiles:  C[C@H](CO[TBDPS])C(=O)OC
```

**Step 12:**
```
reactant_smiles: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC
reagent_smiles:  (empty)
product_smiles:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O
```

---

### claude-sonnet-4.5

**Step 1:**
```
reactant_smiles: COC(=O)C[C@@H](C)O
reagent_smiles:  (empty)
product_smiles:  COC(=O)C[C@@H](C)[OTBDPS]
```

**Step 12:**
```
reactant_smiles: C=CC([C@@H](OAc)C#CC1=CC[C@@H](C)[C@H]1CC[C@H](C)C=O)(C)C[OPMB]
reagent_smiles:  CC(C)(C)[P@@](c1ccccc1-c2ccccc2)[Au]N(C)C
product_smiles:  CC(=O)O[C@]12C(=C3[C@@H]([OPMB])[C@@]4(C)C[C@H]4[C@H]12)[C@@H]1[C@H](C)CC[C@@H]1C[C@H]3C[C@H](C)C=O
```

---

### gemini-3-pro-preview

**Step 1:**
```
reactant_smiles: C[C@H](CO)C(=O)OC
reagent_smiles:  (empty)
product_smiles:  C[C@H](C[OTBDPS])C(=O)OC
```

**Step 12:**
```
reactant_smiles: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)O[Ac])O[PMB]
reagent_smiles:  CC#N[Au+]P(C(C)(C)C)(C(C)(C)C)C1=CC=CC=C1C2=CC=CC=C2.F[Sb-](F)(F)(F)(F)F
product_smiles:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)O[PMB])O[Ac])C=O
```

---

### gpt-5

**Step 1:**
```
reactant_smiles: C[C@H](CO)C(=O)[OMe]
reagent_smiles:  (empty)
product_smiles:  C[C@H](C[OTBDPS])C(=O)[OMe]
```

**Step 12:**
```
reactant_smiles: C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)[OAc])[PMBO]
reagent_smiles:  (empty)
product_smiles:  C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)[PMBO])[OAc])C=O
```

---

## SMILES Comparison Table (Step 1)

| Model | Reactant | Product | Reagent |
|-------|----------|---------|---------|
| **DB Input** | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[Si](C1=CC=CC=C1)(C2=CC=CC=C2)C(C)(C)C)C(=O)OC` | (junk) |
| gemini-2.5-flash-lite | `COC(=O)[C@H](C)CO` | `COC(=O)[C@H](C)CO[Si](C(C)(C)C)(C(C)(C)C)C1=CC=CC=C1` | (empty) |
| gpt-5-nano | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[OTBDPS])(C(=O)OC)` | (empty) |
| gemini-2.5-flash | `C[C@H](CO)C(=O)OC` | `C[C@H](C[OTBDPS])C(=O)OC` | (empty) |
| gpt-5.1 | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[TBDPS])C(=O)OC` | (empty) |
| gpt-5-mini | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[OTBDPS])C(=O)OC` | (empty) |
| gpt-4o-mini | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[Si](C1=CC=CC=C1)(C2=CC=CC=C2)C(C)(C)C)C(=O)OC` | (empty) |
| gpt-4o | `COC(=O)[C@@H](CO)C` | `COC(=O)[C@@H](CO[Si](C(C)(C)C)(C1=CC=CC=C1)C2=CC=CC=C2)C` | (empty) |
| claude-haiku-4.5 | `C[C@H](CO)C(=O)OC` | `C[C@H](CO[TBDPS])C(=O)OC` | `CC(C)(C)[Si](C(C)(C)C)(C(C)(C)C)Cl` |
| claude-sonnet-4.5 | `COC(=O)C[C@@H](C)O` | `COC(=O)C[C@@H](C)[OTBDPS]` | (empty) |
| gemini-3-pro-preview | `C[C@H](CO)C(=O)OC` | `C[C@H](C[OTBDPS])C(=O)OC` | (empty) |
| gpt-5 | `C[C@H](CO)C(=O)[OMe]` | `C[C@H](C[OTBDPS])C(=O)[OMe]` | (empty) |

---

## SMILES Comparison Table (Step 12)

| Model | Reactant | Product |
|-------|----------|---------|
| **DB Input** | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O` |
| gemini-2.5-flash-lite | `C=CC(O[C@@H](C)C(C)(C)OC(=O)C#CC1=CC[C@H](C)[C@@H]1CC[C@H](C)C=O)C2=CC=C(C=C2)OC` | `C[C@@H](C)CC1=C(C(=O)OC)C2CC3CC(C)(C)[C@@H]2C1C3[C@H]([C@@H]4[C@@H]4CC[C@@H](C)[C@H]4OCC5=CC=C(C=C5)OC)CC4OC(=O)C` |
| gpt-5-nano | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O` |
| gemini-2.5-flash | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)[OAc])[PMBO]` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)[PMBO])[OAc])C=O` |
| gpt-5.1 | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)O[OAc])O[PMB]` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)O[PMB])O[OAc])C=O` |
| gpt-5-mini | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCH2c2ccc(OC)cc2` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCH2c5ccc(OC)cc5)OC(=O)C)C=O` |
| gpt-4o-mini | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O` |
| gpt-4o | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O` |
| claude-haiku-4.5 | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)OC(=O)C)OCC2=CC=C(C=C2)OC` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)OCC5=CC=C(C=C5)OC)OC(=O)C)C=O` |
| claude-sonnet-4.5 | `C=CC([C@@H](OAc)C#CC1=CC[C@@H](C)[C@H]1CC[C@H](C)C=O)(C)C[OPMB]` | `CC(=O)O[C@]12C(=C3[C@@H]([OPMB])[C@@]4(C)C[C@H]4[C@H]12)[C@@H]1[C@H](C)CC[C@@H]1C[C@H]3C[C@H](C)C=O` |
| gemini-3-pro-preview | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)O[Ac])O[PMB]` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)O[PMB])O[Ac])C=O` |
| gpt-5 | `C=C[C@@H](C(C)(C)[C@@H](C#CC1=CC[C@H](C)[C@H]1CC[C@H](C)C=O)[OAc])[PMBO]` | `C[C@@H](CC[C@@H]1[C@@H](C)C[C@H]2C1=C([C@]34C[C@@H]4[C@@H]([C@@](C)(C)[C@@H]23)[PMBO])[OAc])C=O` |
