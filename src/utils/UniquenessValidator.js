/**
 * UniquenessValidator - Validates that a problem set has exactly ONE valid solution
 *
 * A puzzle is "uniquely identifiable" if and only if:
 * Given ONLY the observations (not actual compounds), there is exactly ONE
 * valid assignment of compounds to bottles.
 */

// ============ Fingerprint Functions ============

/**
 * Get independent fingerprint for a single bottle (tests that don't require mixing)
 * @param {Object} compound - { cation, anion }
 * @param {Object} cationsData - Cation properties from cations.json
 * @param {Object} reactions - Reaction rules for pH responses
 * @returns {Object} Independent fingerprint
 */
export function getIndependentFingerprint(compound, cationsData, reactions) {
  const cation = compound.cation;
  const anion = compound.anion;

  return {
    solutionColor: cationsData[cation]?.inherent_color || 'colorless',
    flameColor: cationsData[cation]?.flame_color || null,
    pH: getAnionPH(anion, cation, reactions),
    smell: getAnionSmell(anion)
  };
}

/**
 * Get pH level based on anion and cation
 */
function getAnionPH(anion, cation, reactions) {
  const phResponses = reactions?.ph_responses || {};

  // Check specific responses first
  if (cation === 'h+') return 'acidic';
  if (anion === 'oh-') return 'basic';
  if (phResponses[cation]) return phResponses[cation];

  // Anion-based pH
  const basicAnions = ['co3_2-', 's2-', 'po4_3-'];
  if (basicAnions.includes(anion)) return 'basic';

  return 'neutral';
}

/**
 * Get smell based on anion
 */
function getAnionSmell(anion) {
  const smellMap = {
    's2-': 'rotten-eggs',
    'ch3coo-': 'vinegar',
    'nh4+': 'pungent'  // NH4+ solutions can smell
  };
  return smellMap[anion] || 'odorless';
}

/**
 * Get pairwise fingerprint when mixing two bottles
 * @param {Object} bottleA - { cation, anion }
 * @param {Object} bottleB - { cation, anion }
 * @param {Object} reactions - Reaction rules
 * @returns {Object} Pairwise fingerprint
 */
export function getPairwiseFingerprint(bottleA, bottleB, reactions) {
  const rxns = reactions?.reactions || reactions;
  const precipitates = [];
  let gas = null;
  let solutionColor = null;

  // Reaction 1: A.cation + B.anion
  const r1 = rxns[bottleA.cation]?.[bottleB.anion];
  if (r1) {
    processReaction(r1, precipitates, (g) => gas = g, (c) => solutionColor = c);
  }

  // Reaction 2: B.cation + A.anion
  const r2 = rxns[bottleB.cation]?.[bottleA.anion];
  if (r2) {
    processReaction(r2, precipitates, (g) => gas = g, (c) => solutionColor = c);
  }

  // Sort precipitates for consistent comparison
  precipitates.sort((a, b) => (a.color || '').localeCompare(b.color || ''));

  return { precipitates, gas, solutionColor };
}

/**
 * Process a single reaction into fingerprint components
 */
function processReaction(reaction, precipitates, setGas, setSolutionColor) {
  if (reaction.type === 'precipitate') {
    precipitates.push({
      color: reaction.color,
      timeEffect: reaction.time_effect?.change_to || null,
      product: reaction.product,
      solubleIn: reaction.soluble_in || []
    });
  }

  if (reaction.type === 'gas') {
    setGas({ smell: reaction.smell || 'odorless', product: reaction.product });
  }

  if (reaction.type === 'complex' || reaction.type === 'solution') {
    setSolutionColor(reaction.color);
  }

  if (reaction.type === 'turbidity') {
    precipitates.push({
      color: reaction.color,
      isTurbidity: true
    });
  }
}

/**
 * Get tertiary interaction result (adding third reagent to existing precipitate)
 * @param {Object} precipitate - Precipitate from pairwise reaction
 * @param {Object} reagent - Third bottle being added
 * @param {Object} reactions - Reaction rules with tertiary_reactions
 * @returns {Object|null} Dissolution result or null if no reaction
 */
export function getTertiaryResult(precipitate, reagent, reactions) {
  const tertiaryRxns = reactions?.tertiary_reactions || {};
  const product = precipitate.product;

  if (!product || !tertiaryRxns[product]) return null;

  // Check if reagent's anion or cation can dissolve this precipitate
  const dissolution = tertiaryRxns[product];

  // Check anion-based dissolution (e.g., AgCl + NH3 from NH4+ source)
  if (reagent.cation === 'nh4+' && dissolution['nh3']) {
    return {
      dissolves: true,
      result: dissolution['nh3'].result,
      product: dissolution['nh3'].product
    };
  }

  // Check if excess OH- dissolves (amphoteric)
  if (reagent.anion === 'oh-' && dissolution['oh-']) {
    return {
      dissolves: true,
      result: dissolution['oh-'].result,
      product: dissolution['oh-'].product
    };
  }

  // Check acid dissolution
  if (reagent.cation === 'h+' && dissolution['h+']) {
    return {
      dissolves: true,
      result: dissolution['h+'].result,
      product: dissolution['h+'].product
    };
  }

  return null;
}

// ============ Compound Enumeration ============

/**
 * Get all soluble compounds that can exist in solution
 * @param {Object} reactions - Reaction rules
 * @returns {Array} Array of { cation, anion } compounds
 */
export function getAllSolubleCompounds(reactions) {
  const rxns = reactions?.reactions || reactions;

  // All cations we track
  const cations = [
    'ag+', 'ba2+', 'ca2+', 'cu2+', 'fe2+', 'fe3+', 'k+', 'li+', 'na+',
    'nh4+', 'ni2+', 'al3+', 'bi3+', 'pb2+', 'sr2+', 'co2+', 'cr3+',
    'mg2+', 'mn2+', 'zn2+', 'hg2+', 'cd2+', 'sn2+', 'h+'
  ];

  // All anions we track
  const anions = [
    'no3-', 'cl-', 'so4_2-', 'oh-', 's2-', 'co3_2-', 'i-', 'br-',
    'scn-', 'ch3coo-', 'fe_cn_6_4-', 'fe_cn_6_3-', 'po4_3-', 'cro4_2-'
  ];

  const compounds = [];

  for (const cation of cations) {
    for (const anion of anions) {
      // Check if this compound would precipitate itself
      const selfReaction = rxns[cation]?.[anion];
      const isSoluble = !selfReaction || selfReaction.type !== 'precipitate';

      if (isSoluble) {
        compounds.push({ cation, anion });
      }
    }
  }

  return compounds;
}

// ============ Fingerprint Comparison ============

/**
 * Check if two independent fingerprints match
 */
export function independentFingerprintsMatch(fp1, fp2) {
  return (
    fp1.solutionColor === fp2.solutionColor &&
    fp1.flameColor === fp2.flameColor &&
    fp1.pH === fp2.pH &&
    fp1.smell === fp2.smell
  );
}

/**
 * Check if two pairwise fingerprints match
 */
export function pairwiseFingerprintsMatch(fp1, fp2) {
  // Compare precipitates
  if (fp1.precipitates.length !== fp2.precipitates.length) return false;

  for (let i = 0; i < fp1.precipitates.length; i++) {
    const p1 = fp1.precipitates[i];
    const p2 = fp2.precipitates[i];
    if (p1.color !== p2.color) return false;
    if (p1.timeEffect !== p2.timeEffect) return false;
  }

  // Compare gas
  if ((fp1.gas?.smell || null) !== (fp2.gas?.smell || null)) return false;

  // Compare solution color
  if ((fp1.solutionColor || null) !== (fp2.solutionColor || null)) return false;

  return true;
}

/**
 * Compute full reaction matrix for a set of bottles
 * @param {Array} bottles - Array of compounds
 * @param {Object} reactions - Reaction rules
 * @returns {Object} Matrix keyed by "i-j" with pairwise fingerprints
 */
export function computeReactionMatrix(bottles, reactions) {
  const matrix = {};

  for (let i = 0; i < bottles.length; i++) {
    for (let j = i + 1; j < bottles.length; j++) {
      const key = `${i}-${j}`;
      matrix[key] = getPairwiseFingerprint(bottles[i], bottles[j], reactions);
    }
  }

  return matrix;
}

/**
 * Check if two reaction matrices match
 */
export function reactionMatricesMatch(m1, m2) {
  const keys1 = Object.keys(m1).sort();
  const keys2 = Object.keys(m2).sort();

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!pairwiseFingerprintsMatch(m1[key], m2[key])) return false;
  }

  return true;
}

// ============ Backtracking Solver ============

/**
 * Find all valid solutions given observations
 * Uses backtracking with early termination (stops at 2 solutions for uniqueness check)
 *
 * @param {Object} observations - { independent: [], reactions: {} }
 * @param {Object} reactions - Reaction rules
 * @param {Object} cationsData - Cation properties
 * @param {number} maxSolutions - Stop searching after finding this many (default 2)
 * @returns {Array} Array of valid assignments
 */
export function findAllSolutions(observations, reactions, cationsData, maxSolutions = 2) {
  const allCompounds = getAllSolubleCompounds(reactions);
  const numBottles = observations.independent.length;
  const solutions = [];

  // Pre-filter candidates for each position based on independent fingerprint
  const candidatesPerPosition = observations.independent.map(targetFp =>
    allCompounds.filter(compound => {
      const compoundFp = getIndependentFingerprint(compound, cationsData, reactions);
      return independentFingerprintsMatch(compoundFp, targetFp);
    })
  );

  // Log candidate counts for debugging
  const candidateCounts = candidatesPerPosition.map(c => c.length);
  console.log(`  Candidates per position: [${candidateCounts.join(', ')}]`);

  function backtrack(assigned) {
    // Base case: all bottles assigned
    if (assigned.length === numBottles) {
      // Verify reaction matrix matches
      const assignmentMatrix = computeReactionMatrix(assigned, reactions);
      if (reactionMatricesMatch(assignmentMatrix, observations.reactions)) {
        solutions.push([...assigned]);
      }
      return;
    }

    const position = assigned.length;
    const candidates = candidatesPerPosition[position];

    for (const candidate of candidates) {
      // Skip duplicates (same cation+anion already assigned)
      const isDuplicate = assigned.some(
        a => a.cation === candidate.cation && a.anion === candidate.anion
      );
      if (isDuplicate) continue;

      // Early pruning: check reactions with already-assigned bottles
      let valid = true;
      for (let i = 0; i < assigned.length && valid; i++) {
        const expectedKey = `${i}-${position}`;
        const expectedFp = observations.reactions[expectedKey];
        const actualFp = getPairwiseFingerprint(assigned[i], candidate, reactions);

        if (!pairwiseFingerprintsMatch(actualFp, expectedFp)) {
          valid = false;
        }
      }

      if (!valid) continue;

      // Recurse
      backtrack([...assigned, candidate]);

      // Early termination for uniqueness check
      if (solutions.length >= maxSolutions) return;
    }
  }

  backtrack([]);
  return solutions;
}

// ============ Main Validator ============

/**
 * Check if a problem set is uniquely identifiable
 * @param {Array} bottles - Array of compounds { cation, anion }
 * @param {Object} reactions - Reaction rules
 * @param {Object} cationsData - Cation properties
 * @returns {Object} { unique: boolean, solutionCount: number, ambiguousPairs?: [] }
 */
export function isUniquelyIdentifiable(bottles, reactions, cationsData) {
  // 1. Compute observations (what the student would see)
  const observations = {
    independent: bottles.map(b => getIndependentFingerprint(b, cationsData, reactions)),
    reactions: computeReactionMatrix(bottles, reactions)
  };

  // 2. Find all valid solutions (stop at 2)
  const solutions = findAllSolutions(observations, reactions, cationsData, 2);

  // 3. Analyze result
  if (solutions.length === 0) {
    // This shouldn't happen if bottles are from valid compounds
    return { unique: false, solutionCount: 0, error: 'No valid solution found' };
  }

  if (solutions.length === 1) {
    return { unique: true, solutionCount: 1 };
  }

  // Found multiple solutions - identify ambiguous pairs
  const ambiguousPairs = findAmbiguousPairs(bottles, solutions);

  return {
    unique: false,
    solutionCount: solutions.length,
    ambiguousPairs
  };
}

/**
 * Find which bottle positions are swappable between solutions
 */
function findAmbiguousPairs(bottles, solutions) {
  if (solutions.length < 2) return [];

  const pairs = [];
  const sol1 = solutions[0];
  const sol2 = solutions[1];

  for (let i = 0; i < bottles.length; i++) {
    for (let j = i + 1; j < bottles.length; j++) {
      // Check if positions i and j are swapped between solutions
      const sol1HasSwap = (
        sol1[i].cation === sol2[j].cation &&
        sol1[i].anion === sol2[j].anion &&
        sol1[j].cation === sol2[i].cation &&
        sol1[j].anion === sol2[i].anion
      );

      if (sol1HasSwap) {
        pairs.push({
          positions: [i, j],
          compounds: [
            { cation: sol1[i].cation, anion: sol1[i].anion },
            { cation: sol1[j].cation, anion: sol1[j].anion }
          ]
        });
      }
    }
  }

  return pairs;
}

// ============ Tertiary Interaction Support ============

/**
 * Get complete fingerprint including tertiary interactions
 * This is for when three bottles are mixed together
 *
 * @param {Object} bottleA - First bottle
 * @param {Object} bottleB - Second bottle
 * @param {Object} bottleC - Third bottle
 * @param {Object} reactions - Reaction rules with tertiary_reactions
 * @returns {Object} Extended fingerprint including dissolution results
 */
export function getTertiaryFingerprint(bottleA, bottleB, bottleC, reactions) {
  // Get base pairwise fingerprints
  const fpAB = getPairwiseFingerprint(bottleA, bottleB, reactions);
  const fpAC = getPairwiseFingerprint(bottleA, bottleC, reactions);
  const fpBC = getPairwiseFingerprint(bottleB, bottleC, reactions);

  // Check for dissolution of precipitates
  const dissolutions = [];

  // AB precipitates + C
  for (const precip of fpAB.precipitates) {
    const result = getTertiaryResult(precip, bottleC, reactions);
    if (result) {
      dissolutions.push({
        from: 'AB',
        precipitate: precip.product,
        dissolvedBy: `${bottleC.cation}/${bottleC.anion}`,
        result: result
      });
    }
  }

  // AC precipitates + B
  for (const precip of fpAC.precipitates) {
    const result = getTertiaryResult(precip, bottleB, reactions);
    if (result) {
      dissolutions.push({
        from: 'AC',
        precipitate: precip.product,
        dissolvedBy: `${bottleB.cation}/${bottleB.anion}`,
        result: result
      });
    }
  }

  // BC precipitates + A
  for (const precip of fpBC.precipitates) {
    const result = getTertiaryResult(precip, bottleA, reactions);
    if (result) {
      dissolutions.push({
        from: 'BC',
        precipitate: precip.product,
        dissolvedBy: `${bottleA.cation}/${bottleA.anion}`,
        result: result
      });
    }
  }

  return {
    pairwise: { AB: fpAB, AC: fpAC, BC: fpBC },
    dissolutions
  };
}

/**
 * Enhanced uniqueness check that considers tertiary interactions
 * Only used when basic pairwise check finds ambiguity
 *
 * @param {Array} bottles - Compounds in the puzzle
 * @param {Array} ambiguousSolutions - Solutions found by basic solver
 * @param {Object} reactions - Reaction rules with tertiary_reactions
 * @returns {Object} { canDistinguish: boolean, distinguishingTest?: Object }
 */
export function canDistinguishWithTertiary(bottles, ambiguousSolutions, reactions) {
  if (ambiguousSolutions.length < 2) return { canDistinguish: true };
  if (!reactions.tertiary_reactions) return { canDistinguish: false };

  const sol1 = ambiguousSolutions[0];
  const sol2 = ambiguousSolutions[1];

  // Try each possible triple combination
  for (let i = 0; i < bottles.length; i++) {
    for (let j = i + 1; j < bottles.length; j++) {
      for (let k = j + 1; k < bottles.length; k++) {
        const fp1 = getTertiaryFingerprint(sol1[i], sol1[j], sol1[k], reactions);
        const fp2 = getTertiaryFingerprint(sol2[i], sol2[j], sol2[k], reactions);

        // Check if dissolution patterns differ
        if (fp1.dissolutions.length !== fp2.dissolutions.length) {
          return {
            canDistinguish: true,
            distinguishingTest: {
              type: 'tertiary',
              bottles: [i, j, k],
              reason: 'different dissolution count'
            }
          };
        }

        // Check specific dissolutions
        for (let d = 0; d < fp1.dissolutions.length; d++) {
          const d1 = fp1.dissolutions[d];
          const d2 = fp2.dissolutions[d];
          if (d1?.result?.result !== d2?.result?.result) {
            return {
              canDistinguish: true,
              distinguishingTest: {
                type: 'tertiary',
                bottles: [i, j, k],
                reason: `${d1.precipitate} dissolution differs`
              }
            };
          }
        }
      }
    }
  }

  return { canDistinguish: false };
}

// ============ Export for Generator ============

export default {
  getIndependentFingerprint,
  getPairwiseFingerprint,
  getAllSolubleCompounds,
  computeReactionMatrix,
  findAllSolutions,
  isUniquelyIdentifiable,
  getTertiaryResult,
  getTertiaryFingerprint,
  canDistinguishWithTertiary
};
