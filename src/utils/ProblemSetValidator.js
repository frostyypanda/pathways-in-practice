/**
 * Problem Set Validator and Generator for Qualitative Analysis
 *
 * Validates that a set of compounds can be uniquely identified through
 * available tests (mixing, flame, pH, smell) and generates valid problem sets.
 */

/**
 * Check if a cation-anion pair forms a precipitate (i.e., is insoluble)
 */
export function formsPrecipitate(cation, anion, reactions) {
  const rxns = reactions?.reactions || reactions;
  const reaction = rxns[cation]?.[anion];
  return reaction?.type === 'precipitate';
}

/**
 * Check if a compound is soluble (can be in solution)
 */
export function isSoluble(cation, anion, reactions) {
  return !formsPrecipitate(cation, anion, reactions);
}

/**
 * Get the full reaction result when mixing two compounds
 * Returns a normalized object describing what happens
 */
export function getReactionResult(compoundA, compoundB, reactions) {
  const rxns = reactions?.reactions || reactions;
  const results = [];

  // Check A.cation + B.anion
  const r1 = rxns[compoundA.cation]?.[compoundB.anion];
  if (r1) {
    results.push(normalizeReaction(r1, compoundA.cation, compoundB.anion));
  }

  // Check B.cation + A.anion
  const r2 = rxns[compoundB.cation]?.[compoundA.anion];
  if (r2) {
    results.push(normalizeReaction(r2, compoundB.cation, compoundA.anion));
  }

  // Sort for consistent comparison
  results.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return results;
}

/**
 * Normalize a reaction to comparable format
 */
function normalizeReaction(r, cation, anion) {
  return {
    type: r.type,
    color: r.color || null,
    precipitateColor: r.type === 'precipitate' ? r.color : null,
    solutionColor: r.type === 'solution' || r.type === 'complex' ? r.color : null,
    hasTimeEffect: !!r.time_effect,
    timeEffectColor: r.time_effect?.change_to || null,
    hasGas: r.type === 'gas',
    gasProduct: r.product || null,
    smell: r.smell || null,
    cation,
    anion
  };
}

/**
 * Compare two reaction results for equality
 */
export function reactionsEqual(r1, r2) {
  return JSON.stringify(r1) === JSON.stringify(r2);
}

/**
 * Get inherent properties of a compound
 */
export function getInherentProperties(compound, cationsData, reactions) {
  const cation = cationsData?.[compound.cation];
  const rxns = reactions?.reactions || reactions;
  const phResponses = reactions?.ph_responses || {};

  // Determine pH from cation and anion
  let ph = 'neutral';
  if (compound.cation === 'h+') ph = 'acidic';
  else if (compound.anion === 'oh-') ph = 'basic';
  else if (phResponses[compound.cation]) ph = phResponses[compound.cation];

  // Determine smell (mainly from anions)
  let smell = null;
  if (compound.anion === 's2-') smell = 'rotten-eggs'; // H2S smell possible
  if (compound.anion === 'ch3coo-') smell = 'vinegar';

  return {
    flameColor: cation?.flame_color || null,
    inherentColor: cation?.inherent_color || 'colorless',
    ph,
    smell
  };
}

/**
 * Find a test that distinguishes compound A from compound B
 * Returns the distinguishing test or null if indistinguishable
 */
export function findDistinguisher(compoundA, compoundB, allCompounds, reactions, cationsData, reagents = []) {
  const propsA = getInherentProperties(compoundA, cationsData, reactions);
  const propsB = getInherentProperties(compoundB, cationsData, reactions);

  // Check flame test
  if (propsA.flameColor !== propsB.flameColor) {
    return {
      type: 'flame',
      A: propsA.flameColor,
      B: propsB.flameColor,
      description: `Flame test: ${compoundA.formula} shows ${propsA.flameColor || 'no color'}, ${compoundB.formula} shows ${propsB.flameColor || 'no color'}`
    };
  }

  // Check inherent solution color
  if (propsA.inherentColor !== propsB.inherentColor) {
    return {
      type: 'color',
      A: propsA.inherentColor,
      B: propsB.inherentColor,
      description: `Solution color: ${compoundA.formula} is ${propsA.inherentColor}, ${compoundB.formula} is ${propsB.inherentColor}`
    };
  }

  // Check pH
  if (propsA.ph !== propsB.ph) {
    return {
      type: 'pH',
      A: propsA.ph,
      B: propsB.ph,
      description: `pH: ${compoundA.formula} is ${propsA.ph}, ${compoundB.formula} is ${propsB.ph}`
    };
  }

  // Check smell
  if (propsA.smell !== propsB.smell) {
    return {
      type: 'smell',
      A: propsA.smell,
      B: propsB.smell,
      description: `Smell: ${compoundA.formula} smells ${propsA.smell || 'odorless'}, ${compoundB.formula} smells ${propsB.smell || 'odorless'}`
    };
  }

  // Check reactions with other compounds in the set
  for (const other of allCompounds) {
    if (other.formula === compoundA.formula || other.formula === compoundB.formula) continue;

    const rxnA = getReactionResult(compoundA, other, reactions);
    const rxnB = getReactionResult(compoundB, other, reactions);

    if (!reactionsEqual(rxnA, rxnB)) {
      return {
        type: 'reaction',
        with: other.formula,
        A: rxnA,
        B: rxnB,
        description: `Mixing with ${other.formula}: different results`
      };
    }
  }

  // Check reactions with available reagents
  for (const reagent of reagents) {
    const reagentCompound = { cation: null, anion: reagent };

    const rxnA = getReactionResult(compoundA, reagentCompound, reactions);
    const rxnB = getReactionResult(compoundB, reagentCompound, reactions);

    if (!reactionsEqual(rxnA, rxnB)) {
      return {
        type: 'reagent',
        reagent,
        A: rxnA,
        B: rxnB,
        description: `Reagent ${reagent}: different results`
      };
    }
  }

  return null; // Indistinguishable!
}

/**
 * Validate a problem set
 * Returns { valid: boolean, issues: [], distinguishers: {} }
 */
export function validateProblemSet(bottles, reactions, cationsData, availableReagents = []) {
  const issues = [];
  const distinguishers = {};

  // Check solubility of all bottles
  for (const bottle of bottles) {
    if (!isSoluble(bottle.cation, bottle.anion, reactions)) {
      issues.push({
        type: 'insoluble',
        bottle: bottle.formula,
        message: `${bottle.formula} (${bottle.cation} + ${bottle.anion}) forms a precipitate and cannot be in solution`
      });
    }
  }

  // Check pairwise distinguishability
  for (let i = 0; i < bottles.length; i++) {
    for (let j = i + 1; j < bottles.length; j++) {
      const A = bottles[i];
      const B = bottles[j];
      const key = `${A.formula}|${B.formula}`;

      const distinguisher = findDistinguisher(A, B, bottles, reactions, cationsData, availableReagents);

      if (distinguisher) {
        distinguishers[key] = distinguisher;
      } else {
        issues.push({
          type: 'indistinguishable',
          compounds: [A.formula, B.formula],
          message: `Cannot distinguish ${A.formula} from ${B.formula} with available tests`
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    distinguishers
  };
}

/**
 * Generate a valid problem set with N bottles
 * Uses a greedy approach: add compounds one by one, ensuring each is distinguishable from existing ones
 */
export function generateProblemSet(
  n,
  reactions,
  cationsData,
  options = {}
) {
  const {
    availableReagents = [],
    preferredCations = null,
    preferredAnions = null,
    requireFlameTest = false,
    requireColoredSolutions = false,
    maxAttempts = 1000
  } = options;

  // Build pool of soluble compounds
  const pool = buildCompoundPool(reactions, cationsData, {
    preferredCations,
    preferredAnions,
    requireFlameTest,
    requireColoredSolutions
  });

  if (pool.length < n) {
    return {
      success: false,
      error: `Not enough valid compounds in pool (${pool.length}) for ${n} bottles`
    };
  }

  // Shuffle pool for randomness
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Greedy selection
  const selected = [];

  for (const candidate of shuffled) {
    if (selected.length >= n) break;

    // Check if candidate is distinguishable from all selected compounds
    let canAdd = true;
    for (const existing of selected) {
      const distinguisher = findDistinguisher(
        candidate, existing,
        [...selected, candidate],
        reactions, cationsData, availableReagents
      );
      if (!distinguisher) {
        canAdd = false;
        break;
      }
    }

    if (canAdd) {
      selected.push(candidate);
    }
  }

  if (selected.length < n) {
    return {
      success: false,
      error: `Could only find ${selected.length} distinguishable compounds out of ${n} requested`,
      partial: selected
    };
  }

  // Assign labels
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const bottles = selected.map((compound, i) => ({
    ...compound,
    label: labels[i]
  }));

  // Validate the generated set
  const validation = validateProblemSet(bottles, reactions, cationsData, availableReagents);

  return {
    success: validation.valid,
    bottles,
    validation
  };
}

/**
 * Build a pool of soluble compounds from available ions
 */
function buildCompoundPool(reactions, cationsData, options = {}) {
  const {
    preferredCations,
    preferredAnions,
    requireFlameTest,
    requireColoredSolutions
  } = options;

  // Common soluble anions (nitrates and chlorides are usually soluble)
  const solubleAnions = [
    'no3-',   // nitrates always soluble
    'cl-',    // chlorides mostly soluble (except Ag, Pb, Hg)
    'so4_2-', // sulfates mostly soluble (except Ba, Pb, Ca slightly)
    'ch3coo-', // acetates soluble
    'oh-',    // hydroxides of Na, K, Ba soluble
    's2-',    // sulfides of Na, K, NH4 soluble
    'co3_2-', // carbonates of Na, K, NH4 soluble
    'scn-',   // thiocyanates soluble
    'i-',     // iodides mostly soluble
    'br-',    // bromides mostly soluble
    'fe_cn_6_4-', // ferrocyanides soluble as K/Na salts
    'fe_cn_6_3-', // ferricyanides soluble as K/Na salts
  ];

  // Get all cations from cationsData
  const allCations = Object.keys(cationsData || {});

  // Use preferred or all
  const cationsToUse = preferredCations || allCations;
  const anionsToUse = preferredAnions || solubleAnions;

  const pool = [];

  for (const cation of cationsToUse) {
    for (const anion of anionsToUse) {
      // Check solubility
      if (!isSoluble(cation, anion, reactions)) continue;

      // Check flame test requirement
      if (requireFlameTest) {
        const flameColor = cationsData[cation]?.flame_color;
        if (!flameColor) continue;
      }

      // Check colored solution requirement
      if (requireColoredSolutions) {
        const inherentColor = cationsData[cation]?.inherent_color;
        if (!inherentColor || inherentColor === 'colorless') continue;
      }

      // Generate formula and name
      const formula = generateFormula(cation, anion);
      const name = generateName(cation, anion, cationsData);

      pool.push({
        cation,
        anion,
        formula,
        name
      });
    }
  }

  return pool;
}

/**
 * Generate a chemical formula from cation and anion
 */
function generateFormula(cation, anion) {
  const cationFormulas = {
    'ag+': 'Ag', 'ba2+': 'Ba', 'ca2+': 'Ca', 'cu2+': 'Cu',
    'fe2+': 'Fe', 'fe3+': 'Fe', 'k+': 'K', 'li+': 'Li',
    'na+': 'Na', 'nh4+': 'NH₄', 'ni2+': 'Ni', 'al3+': 'Al',
    'bi3+': 'Bi', 'pb2+': 'Pb', 'sr2+': 'Sr', 'co2+': 'Co',
    'cr3+': 'Cr', 'mg2+': 'Mg', 'mn2+': 'Mn', 'zn2+': 'Zn',
    'hg2+': 'Hg', 'cd2+': 'Cd', 'sn2+': 'Sn', 'h+': 'H'
  };

  const anionFormulas = {
    'no3-': 'NO₃', 'cl-': 'Cl', 'so4_2-': 'SO₄', 'oh-': 'OH',
    's2-': 'S', 'co3_2-': 'CO₃', 'i-': 'I', 'br-': 'Br',
    'scn-': 'SCN', 'ch3coo-': 'CH₃COO', 'fe_cn_6_4-': '[Fe(CN)₆]',
    'fe_cn_6_3-': '[Fe(CN)₆]', 'po4_3-': 'PO₄', 'cro4_2-': 'CrO₄',
    'c2o4_2-': 'C₂O₄', 'hco3-': 'HCO₃', 'so3_2-': 'SO₃',
    'f-': 'F', 'mno4-': 'MnO₄'
  };

  const cationCharge = parseInt(cation.match(/(\d+)\+/)?.[1] || '1');
  const anionCharge = parseInt(anion.match(/(\d+)-/)?.[1] || '1');

  // Find LCM for balancing
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  const lcm = (cationCharge * anionCharge) / gcd(cationCharge, anionCharge);

  const cationCount = lcm / cationCharge;
  const anionCount = lcm / anionCharge;

  const cationPart = cationFormulas[cation] || cation.replace(/\d*[+-]/, '');
  const anionPart = anionFormulas[anion] || anion.replace(/\d*-/, '');

  let formula = '';
  if (cationCount > 1) {
    formula += cationPart + (cationCount > 1 ? subscript(cationCount) : '');
  } else {
    formula += cationPart;
  }

  if (anionCount > 1 && anionPart.length > 2) {
    formula += '(' + anionPart + ')' + subscript(anionCount);
  } else if (anionCount > 1) {
    formula += anionPart + subscript(anionCount);
  } else {
    formula += anionPart;
  }

  return formula;
}

function subscript(n) {
  const subs = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  return String(n).split('').map(c => subs[c] || c).join('');
}

/**
 * Generate a compound name from cation and anion
 */
function generateName(cation, anion, cationsData) {
  const cationName = cationsData[cation]?.name || cation;

  const anionNames = {
    'no3-': 'Nitrate', 'cl-': 'Chloride', 'so4_2-': 'Sulfate', 'oh-': 'Hydroxide',
    's2-': 'Sulfide', 'co3_2-': 'Carbonate', 'i-': 'Iodide', 'br-': 'Bromide',
    'scn-': 'Thiocyanate', 'ch3coo-': 'Acetate', 'fe_cn_6_4-': 'Ferrocyanide',
    'fe_cn_6_3-': 'Ferricyanide', 'po4_3-': 'Phosphate', 'cro4_2-': 'Chromate',
    'c2o4_2-': 'Oxalate', 'hco3-': 'Bicarbonate', 'so3_2-': 'Sulfite',
    'f-': 'Fluoride', 'mno4-': 'Permanganate'
  };

  const anionName = anionNames[anion] || anion;

  return `${cationName} ${anionName}`;
}

/**
 * Print a validation report to console
 */
export function printValidationReport(validation, bottles) {
  console.log('\n=== Problem Set Validation Report ===\n');

  console.log('Bottles:');
  for (const b of bottles) {
    console.log(`  ${b.label}: ${b.formula} (${b.name}) - ${b.cation} + ${b.anion}`);
  }

  console.log(`\nValid: ${validation.valid ? 'YES' : 'NO'}`);

  if (validation.issues.length > 0) {
    console.log('\nIssues:');
    for (const issue of validation.issues) {
      console.log(`  - ${issue.message}`);
    }
  }

  console.log('\nDistinguishing Tests:');
  for (const [pair, dist] of Object.entries(validation.distinguishers)) {
    console.log(`  ${pair}: ${dist.description}`);
  }

  return validation;
}
