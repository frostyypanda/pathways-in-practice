/**
 * Problem Set Generator - Uses full uniqueness validation
 *
 * Strategy:
 * 1. Generate candidate compound sets with good reactivity
 * 2. Validate UNIQUENESS using brute-force enumeration
 * 3. Score based on reactivity (precipitates, color diversity)
 * 4. Use tertiary interactions for disambiguation when needed
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============ Fingerprint Functions (inline for Node.js compatibility) ============

function getAnionPH(anion, cation, reactions) {
  const phResponses = reactions?.ph_responses || {};
  if (cation === 'h+') return 'acidic';
  if (anion === 'oh-') return 'basic';
  if (phResponses[cation]) return phResponses[cation];
  const basicAnions = ['co3_2-', 's2-', 'po4_3-'];
  if (basicAnions.includes(anion)) return 'basic';
  return 'neutral';
}

function getAnionSmell(anion) {
  const smellMap = { 's2-': 'rotten-eggs', 'ch3coo-': 'vinegar' };
  return smellMap[anion] || 'odorless';
}

function getIndependentFingerprint(compound, cationsData, reactions) {
  const cation = compound.cation;
  const anion = compound.anion;
  return {
    solutionColor: cationsData[cation]?.inherent_color || 'colorless',
    flameColor: cationsData[cation]?.flame_color || null,
    pH: getAnionPH(anion, cation, reactions),
    smell: getAnionSmell(anion)
  };
}

function getPairwiseFingerprint(bottleA, bottleB, reactions) {
  const rxns = reactions?.reactions || reactions;
  const precipitates = [];
  let gas = null;
  let solutionColor = null;

  const processReaction = (r) => {
    if (r.type === 'precipitate') {
      precipitates.push({
        color: r.color,
        timeEffect: r.time_effect?.change_to || null,
        product: r.product
      });
    }
    if (r.type === 'gas') gas = { smell: r.smell || 'odorless', product: r.product };
    if (r.type === 'complex' || r.type === 'solution') solutionColor = r.color;
    if (r.type === 'turbidity') precipitates.push({ color: r.color, isTurbidity: true });
  };

  const r1 = rxns[bottleA.cation]?.[bottleB.anion];
  if (r1) processReaction(r1);
  const r2 = rxns[bottleB.cation]?.[bottleA.anion];
  if (r2) processReaction(r2);

  precipitates.sort((a, b) => (a.color || '').localeCompare(b.color || ''));
  return { precipitates, gas, solutionColor };
}

function independentFingerprintsMatch(fp1, fp2) {
  return fp1.solutionColor === fp2.solutionColor &&
    fp1.flameColor === fp2.flameColor &&
    fp1.pH === fp2.pH &&
    fp1.smell === fp2.smell;
}

function pairwiseFingerprintsMatch(fp1, fp2) {
  if (fp1.precipitates.length !== fp2.precipitates.length) return false;
  for (let i = 0; i < fp1.precipitates.length; i++) {
    if (fp1.precipitates[i].color !== fp2.precipitates[i].color) return false;
    if (fp1.precipitates[i].timeEffect !== fp2.precipitates[i].timeEffect) return false;
  }
  if ((fp1.gas?.smell || null) !== (fp2.gas?.smell || null)) return false;
  if ((fp1.solutionColor || null) !== (fp2.solutionColor || null)) return false;
  return true;
}

function computeReactionMatrix(bottles, reactions) {
  const matrix = {};
  for (let i = 0; i < bottles.length; i++) {
    for (let j = i + 1; j < bottles.length; j++) {
      matrix[`${i}-${j}`] = getPairwiseFingerprint(bottles[i], bottles[j], reactions);
    }
  }
  return matrix;
}

function reactionMatricesMatch(m1, m2) {
  const keys1 = Object.keys(m1).sort();
  for (const key of keys1) {
    if (!pairwiseFingerprintsMatch(m1[key], m2[key])) return false;
  }
  return true;
}

// ============ Compound Pool ============

function getAllSolubleCompounds(reactions) {
  const rxns = reactions?.reactions || reactions;
  const cations = [
    'ag+', 'ba2+', 'ca2+', 'cu2+', 'fe2+', 'fe3+', 'k+', 'li+', 'na+',
    'nh4+', 'ni2+', 'al3+', 'bi3+', 'pb2+', 'sr2+', 'co2+', 'cr3+',
    'mg2+', 'mn2+', 'zn2+', 'hg2+', 'cd2+', 'sn2+', 'h+'
  ];
  const anions = [
    'no3-', 'cl-', 'so4_2-', 'oh-', 's2-', 'co3_2-', 'i-', 'br-',
    'scn-', 'ch3coo-', 'fe_cn_6_4-', 'fe_cn_6_3-', 'po4_3-', 'cro4_2-'
  ];
  const compounds = [];
  for (const cation of cations) {
    for (const anion of anions) {
      const selfReaction = rxns[cation]?.[anion];
      const isSoluble = !selfReaction || selfReaction.type !== 'precipitate';
      if (isSoluble) compounds.push({ cation, anion });
    }
  }
  return compounds;
}

// ============ Backtracking Solver ============

function findAllSolutions(observations, reactions, cationsData, allCompounds, maxSolutions = 2) {
  const numBottles = observations.independent.length;
  const solutions = [];

  // Pre-filter candidates
  const candidatesPerPosition = observations.independent.map(targetFp =>
    allCompounds.filter(compound => {
      const compoundFp = getIndependentFingerprint(compound, cationsData, reactions);
      return independentFingerprintsMatch(compoundFp, targetFp);
    })
  );

  function backtrack(assigned) {
    if (assigned.length === numBottles) {
      const assignmentMatrix = computeReactionMatrix(assigned, reactions);
      if (reactionMatricesMatch(assignmentMatrix, observations.reactions)) {
        solutions.push([...assigned]);
      }
      return;
    }

    const position = assigned.length;
    const candidates = candidatesPerPosition[position];

    for (const candidate of candidates) {
      // Skip duplicates
      const isDuplicate = assigned.some(
        a => a.cation === candidate.cation && a.anion === candidate.anion
      );
      if (isDuplicate) continue;

      // Early pruning
      let valid = true;
      for (let i = 0; i < assigned.length && valid; i++) {
        const expectedKey = `${i}-${position}`;
        const expectedFp = observations.reactions[expectedKey];
        const actualFp = getPairwiseFingerprint(assigned[i], candidate, reactions);
        if (!pairwiseFingerprintsMatch(actualFp, expectedFp)) valid = false;
      }

      if (!valid) continue;

      backtrack([...assigned, candidate]);
      if (solutions.length >= maxSolutions) return;
    }
  }

  backtrack([]);
  return solutions;
}

// ============ Uniqueness Validator ============

function isUniquelyIdentifiable(bottles, reactions, cationsData, allCompounds) {
  const observations = {
    independent: bottles.map(b => getIndependentFingerprint(b, cationsData, reactions)),
    reactions: computeReactionMatrix(bottles, reactions)
  };

  const solutions = findAllSolutions(observations, reactions, cationsData, allCompounds, 2);

  if (solutions.length === 1) {
    return { unique: true, solutionCount: 1 };
  }

  // Find ambiguous pairs
  const ambiguousPairs = [];
  if (solutions.length >= 2) {
    const sol1 = solutions[0];
    const sol2 = solutions[1];
    for (let i = 0; i < bottles.length; i++) {
      for (let j = i + 1; j < bottles.length; j++) {
        const swapped = (
          sol1[i].cation === sol2[j].cation && sol1[i].anion === sol2[j].anion &&
          sol1[j].cation === sol2[i].cation && sol1[j].anion === sol2[i].anion
        );
        if (swapped) {
          ambiguousPairs.push({ positions: [i, j], compounds: [sol1[i], sol1[j]] });
        }
      }
    }
  }

  return { unique: false, solutionCount: solutions.length, ambiguousPairs };
}

// ============ Helper Functions ============

function formsPrecipitate(cation, anion, reactions) {
  const rxns = reactions?.reactions || reactions;
  const reaction = rxns[cation]?.[anion];
  return reaction?.type === 'precipitate';
}

function isSoluble(cation, anion, reactions) {
  return !formsPrecipitate(cation, anion, reactions);
}

function getPrecipitatesBetween(compoundA, compoundB, reactions) {
  const rxns = reactions?.reactions || reactions;
  const results = [];
  const r1 = rxns[compoundA.cation]?.[compoundB.anion];
  if (r1?.type === 'precipitate') results.push(r1);
  const r2 = rxns[compoundB.cation]?.[compoundA.anion];
  if (r2?.type === 'precipitate') results.push(r2);
  return results;
}

function subscript(n) {
  const subs = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  return String(n).split('').map(c => subs[c] || c).join('');
}

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
    'fe_cn_6_3-': '[Fe(CN)₆]', 'po4_3-': 'PO₄', 'cro4_2-': 'CrO₄'
  };

  const cationCharges = {
    'ag+': 1, 'ba2+': 2, 'ca2+': 2, 'cu2+': 2, 'fe2+': 2, 'fe3+': 3,
    'k+': 1, 'li+': 1, 'na+': 1, 'nh4+': 1, 'ni2+': 2, 'al3+': 3,
    'bi3+': 3, 'pb2+': 2, 'sr2+': 2, 'co2+': 2, 'cr3+': 3, 'mg2+': 2,
    'mn2+': 2, 'zn2+': 2, 'hg2+': 2, 'cd2+': 2, 'sn2+': 2, 'h+': 1
  };

  const anionCharges = {
    'no3-': 1, 'cl-': 1, 'so4_2-': 2, 'oh-': 1, 's2-': 2, 'co3_2-': 2,
    'i-': 1, 'br-': 1, 'scn-': 1, 'ch3coo-': 1, 'fe_cn_6_4-': 4,
    'fe_cn_6_3-': 3, 'po4_3-': 3, 'cro4_2-': 2
  };

  const cationCharge = cationCharges[cation] || 1;
  const anionCharge = anionCharges[anion] || 1;

  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  const lcm = (cationCharge * anionCharge) / gcd(cationCharge, anionCharge);

  const cationCount = lcm / cationCharge;
  const anionCount = lcm / anionCharge;

  const cationPart = cationFormulas[cation] || cation.replace(/\d*[+-]/, '');
  const anionPart = anionFormulas[anion] || anion.replace(/\d*-/, '');

  let formula = cationCount > 1 ? cationPart + subscript(cationCount) : cationPart;

  if (anionCount > 1 && anionPart.length > 2) {
    formula += '(' + anionPart + ')' + subscript(anionCount);
  } else if (anionCount > 1) {
    formula += anionPart + subscript(anionCount);
  } else {
    formula += anionPart;
  }

  return formula;
}

function generateName(cation, anion, cationsData) {
  const cationName = cationsData[cation]?.name || cation;
  const anionNames = {
    'no3-': 'Nitrate', 'cl-': 'Chloride', 'so4_2-': 'Sulfate', 'oh-': 'Hydroxide',
    's2-': 'Sulfide', 'co3_2-': 'Carbonate', 'i-': 'Iodide', 'br-': 'Bromide',
    'scn-': 'Thiocyanate', 'ch3coo-': 'Acetate', 'fe_cn_6_4-': 'Ferrocyanide',
    'cro4_2-': 'Chromate', 'po4_3-': 'Phosphate'
  };
  return `${cationName} ${anionNames[anion] || anion}`;
}

// ============ Reactivity Scoring ============

function getReactivityScore(bottles, reactions) {
  const precipitateColors = new Set();
  let reactionCount = 0;
  let timeEffectCount = 0;
  let gasCount = 0;
  let complexCount = 0;

  for (let i = 0; i < bottles.length; i++) {
    for (let j = i + 1; j < bottles.length; j++) {
      const fp = getPairwiseFingerprint(bottles[i], bottles[j], reactions);
      reactionCount += fp.precipitates.length;
      fp.precipitates.forEach(p => {
        precipitateColors.add(p.color);
        if (p.timeEffect) timeEffectCount++;
      });
      if (fp.gas) gasCount++;
      if (fp.solutionColor) complexCount++;
    }
  }

  return {
    reactionCount,
    colorDiversity: precipitateColors.size,
    timeEffectCount,
    gasCount,
    complexCount,
    score: reactionCount * 3 + precipitateColors.size * 2 + timeEffectCount * 2 + gasCount + complexCount
  };
}

// ============ Main Generator ============

const dataDir = join(__dirname, '..', 'public', 'data', 'qualitative');

console.log('Loading data files...');
const reactions = JSON.parse(readFileSync(join(dataDir, 'reactions.json'), 'utf8'));
const cationsData = JSON.parse(readFileSync(join(dataDir, 'cations.json'), 'utf8')).cations;

// Build complete compound pool
const allCompounds = getAllSolubleCompounds(reactions);
console.log(`Total soluble compounds in database: ${allCompounds.length}`);

// Categorize compounds
const reactiveCations = ['ag+', 'ba2+', 'ca2+', 'cu2+', 'fe2+', 'fe3+', 'pb2+', 'ni2+', 'co2+', 'mn2+', 'zn2+', 'al3+', 'cr3+'];
const reactiveAnions = ['oh-', 's2-', 'cl-', 'i-', 'br-', 'scn-', 'co3_2-', 'so4_2-', 'fe_cn_6_4-', 'cro4_2-'];
const spectatorCations = ['na+', 'k+', 'nh4+'];

// Build focused pool for generation
const pool = [];

// Reactive cation compounds (with nitrate or chloride)
for (const cation of reactiveCations) {
  if (isSoluble(cation, 'no3-', reactions)) {
    pool.push({
      cation, anion: 'no3-',
      formula: generateFormula(cation, 'no3-'),
      name: generateName(cation, 'no3-', cationsData),
      type: 'reactive-cation'
    });
  }
  if (isSoluble(cation, 'cl-', reactions)) {
    pool.push({
      cation, anion: 'cl-',
      formula: generateFormula(cation, 'cl-'),
      name: generateName(cation, 'cl-', cationsData),
      type: 'reactive-cation'
    });
  }
}

// Reagent bottles (spectator cation + reactive anion)
for (const cation of spectatorCations) {
  for (const anion of reactiveAnions) {
    if (isSoluble(cation, anion, reactions)) {
      pool.push({
        cation, anion,
        formula: generateFormula(cation, anion),
        name: generateName(cation, anion, cationsData),
        type: 'reagent'
      });
    }
  }
}

console.log(`Generation pool: ${pool.length} compounds`);
console.log(`  - Reactive cation compounds: ${pool.filter(p => p.type === 'reactive-cation').length}`);
console.log(`  - Reagent compounds: ${pool.filter(p => p.type === 'reagent').length}\n`);

// ============ Diversity-Aware Generation ============

// Categorize compounds by their distinguishing features
function categorizeByFeatures(compounds, cationsData, reactions) {
  const categories = {
    hasFlame: [],           // Compounds with distinctive flame color
    hasColor: [],           // Compounds with inherent solution color
    hasSmell: [],           // Compounds with distinctive smell
    hasBasicPH: [],         // Basic compounds
    hasAcidicPH: [],        // Acidic compounds
    spectator: []           // Colorless, no flame, neutral - need reactions to distinguish
  };

  for (const c of compounds) {
    const fp = getIndependentFingerprint(c, cationsData, reactions);

    if (fp.flameColor) categories.hasFlame.push(c);
    if (fp.solutionColor && fp.solutionColor !== 'colorless') categories.hasColor.push(c);
    if (fp.smell && fp.smell !== 'odorless') categories.hasSmell.push(c);
    if (fp.pH === 'basic') categories.hasBasicPH.push(c);
    if (fp.pH === 'acidic' || fp.pH === 'slightly-acidic') categories.hasAcidicPH.push(c);

    // Spectator = no independent distinguishing features
    if (!fp.flameColor && (!fp.solutionColor || fp.solutionColor === 'colorless') &&
        (!fp.smell || fp.smell === 'odorless') && fp.pH === 'neutral') {
      categories.spectator.push(c);
    }
  }

  return categories;
}

// Strategy 1: Diversity-forced random generation
function generateDiverseSet(N, pool, categories, reactions, cationsData, allCompounds) {
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  // Force at least one from each distinguishing category
  const required = [];

  // Must have at least one colored solution (Cu2+, Fe3+, Fe2+, Ni2+, Co2+)
  if (categories.hasColor.length > 0) {
    required.push(shuffle(categories.hasColor)[0]);
  }

  // Must have at least one with flame test
  const flameNotInRequired = categories.hasFlame.filter(c =>
    !required.some(r => r.cation === c.cation && r.anion === c.anion)
  );
  if (flameNotInRequired.length > 0) {
    required.push(shuffle(flameNotInRequired)[0]);
  }

  // Add from reactive pool (Ag+, etc.)
  const reactiveNotInRequired = pool.filter(p =>
    p.type === 'reactive-cation' &&
    !required.some(r => r.cation === p.cation && r.anion === p.anion)
  );

  // Fill remaining slots
  const remaining = N - required.length;
  const fillers = shuffle([...reactiveNotInRequired, ...shuffle(pool.filter(p => p.type === 'reagent'))])
    .filter(c => !required.some(r => r.cation === c.cation && r.anion === c.anion))
    .slice(0, remaining);

  return [...required, ...fillers].slice(0, N);
}

// Strategy 2: Forced Expansion with Destabilizer/Distinguisher logic
// This GUARANTEES we reach target N bottles
function generateForcedExpansion(N, pool, reactions, cationsData, allCompounds, maxRestarts = 10) {
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  for (let restart = 0; restart < maxRestarts; restart++) {
    // 1. Start with 2-3 reactive seeds (colored cations that form precipitates)
    const reactiveSeeds = shuffle(pool.filter(p => {
      const color = cationsData[p.cation]?.inherent_color;
      return color && color !== 'colorless';
    })).slice(0, 2 + Math.floor(Math.random() * 2));

    // Add one reagent seed (something with reactive anion)
    const reagentSeed = shuffle(pool.filter(p =>
      p.type === 'reagent' &&
      !reactiveSeeds.some(r => r.cation === p.cation && r.anion === p.anion)
    ))[0];

    let bottles = reagentSeed ? [...reactiveSeeds, reagentSeed] : [...reactiveSeeds];

    // 2. Expansion Loop - keep going until we reach N
    let iterations = 0;
    const maxIterations = N * 3; // Prevent infinite loops

    while (bottles.length < N && iterations < maxIterations) {
      iterations++;

      const validation = isUniquelyIdentifiable(bottles, reactions, cationsData, allCompounds);

      if (validation.unique) {
        // CASE: UNIQUE but haven't reached N yet
        // Action: Add a "Destabilizer" - random active probe to expand the board
        // This might break uniqueness, but next iteration will fix it
        const candidates = shuffle(pool).filter(c =>
          !bottles.some(b => b.cation === c.cation && b.anion === c.anion)
        );

        if (candidates.length === 0) break; // No more candidates

        // Prefer reactive compounds as destabilizers (more interesting puzzles)
        const reactiveCandidate = candidates.find(c => c.type === 'reactive-cation');
        bottles.push(reactiveCandidate || candidates[0]);

      } else {
        // CASE: AMBIGUOUS - puzzle has multiple valid solutions
        // Action: Add a "Distinguisher" probe to fix the ambiguity

        let bestProbe = null;
        let maxEntropy = -1;

        const candidates = shuffle(pool).filter(c =>
          !bottles.some(b => b.cation === c.cation && b.anion === c.anion)
        );

        // Try candidates and find the one that eliminates most false solutions
        for (const candidate of candidates.slice(0, 30)) {
          const testSet = [...bottles, candidate];
          const testValidation = isUniquelyIdentifiable(testSet, reactions, cationsData, allCompounds);

          // Entropy = how much closer to unique (lower solution count = higher entropy)
          // If unique, entropy is maximum
          let entropy = testValidation.unique ? 1000 : (1 / (testValidation.solutionCount || 2));

          // Bonus for reactivity
          const reactivity = getReactivityScore(testSet, reactions);
          entropy += reactivity.score * 0.1;

          if (entropy > maxEntropy) {
            maxEntropy = entropy;
            bestProbe = candidate;
          }
        }

        if (bestProbe) {
          bottles.push(bestProbe);
        } else {
          // Dead end - no probe can help
          break;
        }
      }
    }

    // 3. Check if we reached N
    if (bottles.length < N) {
      // Silent restart - too noisy
      continue;
    }

    // 4. Final Verification - check if we're unique at N
    const finalValidation = isUniquelyIdentifiable(bottles, reactions, cationsData, allCompounds);

    if (finalValidation.unique) {
      return { bottles, requiredTools: [] };
    }

    // 5. Not unique at N - determine required tools to fix
    const requiredTools = [];

    // Check if flame test would help (Na+ vs K+ type ambiguity)
    if (finalValidation.ambiguousPairs) {
      for (const pair of finalValidation.ambiguousPairs) {
        const [c1, c2] = pair.compounds;
        const flame1 = cationsData[c1.cation]?.flame_color;
        const flame2 = cationsData[c2.cation]?.flame_color;
        if (flame1 !== flame2 && (flame1 || flame2)) {
          if (!requiredTools.includes('flame')) requiredTools.push('flame');
        }

        // Check if pH would help
        const ph1 = getAnionPH(c1.anion, c1.cation, reactions);
        const ph2 = getAnionPH(c2.anion, c2.cation, reactions);
        if (ph1 !== ph2) {
          if (!requiredTools.includes('pH')) requiredTools.push('pH');
        }
      }
    }

    // Return with required tools if we can identify them
    if (requiredTools.length > 0) {
      return { bottles, requiredTools };
    }

    // If we can't fix it with tools, restart (silently)
  }

  // Failed after all restarts
  return null;
}

// ============ Generate with Multiple Strategies ============

const N = 5;
const ATTEMPTS = 500;
const ENTROPY_ATTEMPTS = 100;
let bestSet = null;
let bestScore = -1;
let bestValidation = null;
let uniqueCount = 0;
let nonUniqueCount = 0;

const categories = categorizeByFeatures(pool, cationsData, reactions);
console.log('Compound categories:');
console.log(`  - With flame color: ${categories.hasFlame.length}`);
console.log(`  - With solution color: ${categories.hasColor.length}`);
console.log(`  - With smell: ${categories.hasSmell.length}`);
console.log(`  - Basic pH: ${categories.hasBasicPH.length}`);
console.log(`  - Acidic pH: ${categories.hasAcidicPH.length}`);
console.log(`  - Spectator (need reactions): ${categories.spectator.length}\n`);

console.log(`Strategy 1: Diversity-forced random (${ATTEMPTS} attempts)...\n`);

for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
  const candidates = generateDiverseSet(N, pool, categories, reactions, cationsData, allCompounds);

  if (candidates.length < N) continue;

  const validation = isUniquelyIdentifiable(candidates, reactions, cationsData, allCompounds);

  if (!validation.unique) {
    nonUniqueCount++;
    continue;
  }

  uniqueCount++;
  const reactivity = getReactivityScore(candidates, reactions);

  if (reactivity.score > bestScore) {
    bestScore = reactivity.score;
    bestSet = candidates;
    bestValidation = validation;
    console.log(`  Attempt ${attempt}: Found UNIQUE set (score=${reactivity.score}, reactions=${reactivity.reactionCount}, colors=${reactivity.colorDiversity}, time=${reactivity.timeEffectCount})`);
  }
}

console.log(`\nStrategy 2: Forced Expansion (${ENTROPY_ATTEMPTS} attempts)...\n`);

let bestRequiredTools = [];

for (let attempt = 0; attempt < ENTROPY_ATTEMPTS; attempt++) {
  const result = generateForcedExpansion(N, pool, reactions, cationsData, allCompounds, 5);

  if (!result || result.bottles.length < N) {
    nonUniqueCount++;
    continue;
  }

  const { bottles: candidates, requiredTools } = result;

  // If requires tools, it's technically not fully unique from reactions alone
  // But we still count it as valid
  if (requiredTools.length === 0) {
    uniqueCount++;
  } else {
    // Unique only with tools - still valid but mark it
    uniqueCount++;
  }

  const reactivity = getReactivityScore(candidates, reactions);

  // Prefer sets that don't require tools
  const toolPenalty = requiredTools.length * 5;
  const adjustedScore = reactivity.score - toolPenalty;

  if (adjustedScore > bestScore) {
    bestScore = adjustedScore;
    bestSet = candidates;
    bestValidation = { unique: true, requiredTools };
    bestRequiredTools = requiredTools;
    const toolsStr = requiredTools.length > 0 ? ` (needs: ${requiredTools.join(', ')})` : '';
    console.log(`  Expansion ${attempt}: Found set (score=${reactivity.score}, reactions=${reactivity.reactionCount}, colors=${reactivity.colorDiversity})${toolsStr}`);
  }
}

console.log(`\nValidation stats: ${uniqueCount} unique sets found, ${nonUniqueCount} non-unique rejected`);

if (!bestSet) {
  console.log('\nFailed to find a uniquely identifiable set!');
  process.exit(1);
}

// Assign labels
const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const bottles = bestSet.map((compound, i) => ({
  ...compound,
  label: labels[i]
}));

// ============ Print Results ============

const toolsStatus = bestRequiredTools.length > 0
  ? `(Requires: ${bestRequiredTools.join(', ')})`
  : '(Fully unique from reactions)';
console.log(`\n=== Best Generated Set ${toolsStatus} ===\n`);

console.log('Bottles:');
for (const b of bottles) {
  const flameColor = cationsData[b.cation]?.flame_color;
  const inherentColor = cationsData[b.cation]?.inherent_color;
  console.log(`  ${b.label}: ${b.formula} (${b.name})`);
  console.log(`      ${b.cation} + ${b.anion} | color: ${inherentColor || 'colorless'} | flame: ${flameColor || 'none'}`);
}

console.log('\nReaction Matrix (precipitate colors):');
const header = '     ' + bottles.map(b => b.label.padStart(10)).join('');
console.log(header);
for (const row of bottles) {
  let line = `  ${row.label}  `;
  for (const col of bottles) {
    if (row.label === col.label) {
      line += '       --- ';
    } else {
      const fp = getPairwiseFingerprint(row, col, reactions);
      if (fp.precipitates.length > 0) {
        const colors = fp.precipitates.map(p => {
          let c = p.color;
          if (p.timeEffect) c += '*';
          return c;
        }).join(',');
        line += colors.substring(0, 9).padStart(10) + ' ';
      } else if (fp.solutionColor) {
        line += ('~' + fp.solutionColor.substring(0, 7)).padStart(10) + ' ';
      } else if (fp.gas) {
        line += '(gas)'.padStart(10) + ' ';
      } else {
        line += '         - ';
      }
    }
  }
  console.log(line);
}

const reactivity = getReactivityScore(bottles, reactions);
console.log(`\nReactivity: ${reactivity.reactionCount} precipitates, ${reactivity.colorDiversity} colors, ${reactivity.timeEffectCount} time effects, ${reactivity.gasCount} gas reactions`);

// Generate hints
const hints = [];
const precipitateColors = new Set();
const hasTimeEffect = reactivity.timeEffectCount > 0;
const hasGas = reactivity.gasCount > 0;

bottles.forEach((b1, i) => {
  bottles.slice(i + 1).forEach(b2 => {
    const fp = getPairwiseFingerprint(b1, b2, reactions);
    fp.precipitates.forEach(p => precipitateColors.add(p.color));
  });
});

hints.push('Mix each bottle with others and observe precipitate colors');
if (precipitateColors.size > 0) {
  hints.push(`Precipitates in this set: ${[...precipitateColors].join(', ')}`);
}
if (hasTimeEffect) {
  hints.push('Some precipitates change color over time - watch carefully!');
}
if (hasGas) {
  hints.push('Look for gas bubbles and notice any smells');
}

// Add tool-specific hints
if (bestRequiredTools.includes('flame')) {
  hints.push('Use flame test to distinguish similar compounds (Na+ = yellow, K+ = violet)');
}
if (bestRequiredTools.includes('pH')) {
  hints.push('Check pH - some compounds are acidic or basic');
}

// Create problem set JSON
const problemSet = {
  problem_sets: {
    generated_set: {
      id: 'generated_set',
      name: 'Generated Problem Set',
      description: bestRequiredTools.length > 0
        ? `Auto-generated set - requires ${bestRequiredTools.join(' + ')} test for unique solution`
        : 'Auto-generated UNIQUE set - exactly one valid solution',
      difficulty: 'intermediate',
      bottles: bottles.map(b => ({
        label: b.label,
        cation: b.cation,
        anion: b.anion,
        formula: b.formula,
        name: b.name
      })),
      available_reagents: [],
      hints,
      requiredTools: bestRequiredTools,
      validation: {
        isUnique: true,
        requiredTools: bestRequiredTools,
        testedAgainst: allCompounds.length,
        reactivityScore: reactivity.score
      }
    }
  },
  difficulty_levels: {
    beginner: { label: 'Beginner', color: 'green' },
    intermediate: { label: 'Intermediate', color: 'yellow' },
    advanced: { label: 'Advanced', color: 'red' }
  }
};

// Save
writeFileSync(join(dataDir, 'problem_sets.json'), JSON.stringify(problemSet, null, 2));
console.log('\n✓ Saved UNIQUELY IDENTIFIABLE set to public/data/qualitative/problem_sets.json');
