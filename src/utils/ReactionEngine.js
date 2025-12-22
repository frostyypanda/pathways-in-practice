/**
 * ReactionEngine - Pure logic for qualitative analysis reactions
 * No React dependencies - can be unit tested independently
 */

/**
 * Get all ions present in a well based on the substances added
 * @param {Array} substances - Array of substance objects with cation/anion
 * @returns {Set} Set of ion identifiers
 */
export function collectIons(substances) {
  const ions = new Set();
  substances.forEach(substance => {
    if (substance.cation) ions.add(substance.cation);
    if (substance.anion) ions.add(substance.anion);
  });
  return ions;
}

/**
 * Find all matching reactions for the ions present
 * @param {Set} ions - Set of ion identifiers present
 * @param {Object} reactionRules - Reaction rules from reactions.json
 * @returns {Array} Array of matched reaction results
 */
export function findReactions(ions, reactionRules) {
  const results = [];
  const ionsArray = Array.from(ions);

  // Check each cation against each anion/reagent
  ionsArray.forEach(ion => {
    if (reactionRules[ion]) {
      const cationReactions = reactionRules[ion];
      ionsArray.forEach(otherIon => {
        if (ion !== otherIon && cationReactions[otherIon]) {
          results.push({
            cation: ion,
            reagent: otherIon,
            ...cationReactions[otherIon]
          });
        }
      });
    }
  });

  return results;
}

/**
 * Calculate the current visual state of a well
 * @param {Object} wellData - Well data including substances and timestamps
 * @param {Object} reactionRules - Reaction rules from reactions.json
 * @param {number} currentTime - Current timestamp for time effects
 * @returns {Object} Visual state { color, hasGas, precipitateType, smell, phLevel }
 */
export function calculateWellState(wellData, reactionRules, currentTime) {
  if (!wellData || !wellData.substances || wellData.substances.length === 0) {
    return null;
  }

  const ions = collectIons(wellData.substances);
  const reactions = findReactions(ions, reactionRules);
  const elapsed = currentTime - wellData.lastInteraction;

  // Default state
  const state = {
    color: null,
    hasGas: false,
    gasDuration: 0,
    precipitateType: null,
    smell: 'odorless',
    phLevel: 'neutral',
    reactions: reactions,
    notes: []
  };

  // Process each reaction
  reactions.forEach(reaction => {
    // Handle gas evolution
    if (reaction.type === 'gas') {
      const duration = reaction.duration_ms || 6000;
      if (elapsed < duration) {
        state.hasGas = true;
        state.gasDuration = duration - elapsed;
      }
      if (reaction.notes) state.notes.push(reaction.notes);
    }

    // Handle precipitates
    if (reaction.type === 'precipitate') {
      let color = reaction.color;

      // Check for time-dependent color change
      if (reaction.time_effect && elapsed > reaction.time_effect.delay_ms) {
        color = reaction.time_effect.change_to;
      }

      state.color = color;
      state.precipitateType = 'precipitate';
      state.product = reaction.product;
      if (reaction.notes) state.notes.push(reaction.notes);
    }

    // Handle complex formation (soluble colored products)
    if (reaction.type === 'complex') {
      state.color = reaction.color;
      state.precipitateType = 'complex';
      state.product = reaction.product;
      if (reaction.notes) state.notes.push(reaction.notes);
    }

    // Handle soluble (no visible change)
    if (reaction.type === 'soluble') {
      if (reaction.notes) state.notes.push(reaction.notes);
    }
  });

  // Calculate pH based on ions present
  state.phLevel = calculatePh(ions);

  // Determine smell
  state.smell = determineSmell(ions, reactions, wellData.substances);

  return state;
}

/**
 * Calculate approximate pH based on ions present
 * @param {Set} ions - Set of ions present
 * @returns {string} 'acidic' | 'neutral' | 'basic'
 */
export function calculatePh(ions) {
  const acidicIons = ['h+'];
  const basicIons = ['oh-', 'nh3', 'co3_2-', 'hco3-'];

  let acidCount = 0;
  let baseCount = 0;

  ions.forEach(ion => {
    if (acidicIons.includes(ion)) acidCount++;
    if (basicIons.includes(ion)) baseCount++;
  });

  if (acidCount > baseCount) return 'acidic';
  if (baseCount > acidCount) return 'basic';
  return 'neutral';
}

/**
 * Determine smell based on substances and reactions
 * @param {Set} ions - Set of ions present
 * @param {Array} reactions - Active reactions
 * @param {Array} substances - Original substances
 * @returns {string} Smell description
 */
export function determineSmell(ions, reactions, substances) {
  // Check for H2S gas
  if (ions.has('h+') && ions.has('s2-')) {
    return 'rotten-eggs';
  }

  // Check for NH3
  if (ions.has('nh3') || ions.has('nh4+')) {
    // NH4+ with base releases NH3
    if (ions.has('oh-') && ions.has('nh4+')) {
      return 'pungent';
    }
    if (ions.has('nh3')) {
      return 'pungent';
    }
  }

  // Check for HCl (pungent when concentrated)
  if (ions.has('h+') && ions.has('cl-')) {
    return 'pungent';
  }

  return 'odorless';
}

/**
 * Get the color value for CSS styling
 * @param {string} colorName - Color name from reaction data
 * @returns {string} Tailwind color class or hex value
 */
export function getColorClass(colorName) {
  const colorMap = {
    'white': 'bg-white',
    'black': 'bg-neutral-900',
    'yellow': 'bg-yellow-300',
    'pale-yellow': 'bg-yellow-100',
    'orange': 'bg-orange-400',
    'red': 'bg-red-500',
    'red-brown': 'bg-amber-700',
    'brown': 'bg-amber-800',
    'green': 'bg-green-500',
    'green-white': 'bg-green-100',
    'blue': 'bg-blue-500',
    'blue-green': 'bg-teal-500',
    'deep-blue': 'bg-blue-700',
    'prussian-blue': 'bg-blue-900',
    'blue-violet': 'bg-violet-500',
    'violet': 'bg-violet-600',
    'pink': 'bg-pink-300',
    'pale-pink': 'bg-pink-100',
    'gray': 'bg-gray-400',
    'colorless': 'bg-transparent',
    'blood-red': 'bg-red-700'
  };

  return colorMap[colorName] || 'bg-gray-300';
}

/**
 * Get pH indicator color
 * @param {string} phLevel - 'acidic' | 'neutral' | 'basic'
 * @returns {string} Tailwind color class
 */
export function getPhColor(phLevel) {
  const phColors = {
    'acidic': 'bg-red-500',
    'neutral': 'bg-green-500',
    'basic': 'bg-indigo-700'
  };

  return phColors[phLevel] || 'bg-green-500';
}

/**
 * Shuffle an array (for randomizing bottle assignments)
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Create a game instance with randomized bottle assignments
 * @param {Object} problemSet - Problem set configuration
 * @returns {Object} Game state with mapping
 */
export function initializeGame(problemSet) {
  const shuffledBottles = shuffleArray([...problemSet.bottles]);
  const labels = ['A', 'B', 'C', 'D', 'E'].slice(0, problemSet.bottles.length);

  const mapping = {};
  labels.forEach((label, index) => {
    mapping[label] = shuffledBottles[index];
  });

  return {
    problemSetId: problemSet.id,
    mapping,
    labels
  };
}

/**
 * Check if guesses are correct
 * @param {Object} guesses - User's guesses { A: 'HCl', B: 'NaCl', ... }
 * @param {Object} mapping - Correct mapping { A: { formula: 'HCl' }, ... }
 * @returns {Object} Results { A: true, B: false, ... } and win status
 */
export function checkSolution(guesses, mapping) {
  const results = {};
  let allCorrect = true;

  Object.keys(mapping).forEach(label => {
    const guess = (guesses[label] || '').toLowerCase().replace(/\s/g, '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (m) => {
      return '0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(m)];
    });
    const correct = mapping[label].formula.toLowerCase().replace(/\s/g, '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (m) => {
      return '0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(m)];
    });

    const isCorrect = guess === correct;
    results[label] = isCorrect;
    if (!isCorrect) allCorrect = false;
  });

  return { results, win: allCorrect };
}
