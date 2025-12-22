/**
 * ReactionEngine - Pure logic for qualitative analysis reactions
 * No React dependencies - can be unit tested independently
 */

/**
 * Get all ions present in a well based on the substances added
 * Also tracks counts for excess detection
 * @param {Array} substances - Array of substance objects with cation/anion
 * @returns {Object} { ions: Set, counts: Map }
 */
export function collectIons(substances) {
  const ions = new Set();
  const counts = new Map();

  substances.forEach(substance => {
    if (substance.cation) {
      ions.add(substance.cation);
      counts.set(substance.cation, (counts.get(substance.cation) || 0) + 1);
    }
    if (substance.anion) {
      ions.add(substance.anion);
      counts.set(substance.anion, (counts.get(substance.anion) || 0) + 1);
    }
  });

  return { ions, counts };
}

/**
 * Check if there's an excess of a reagent (2:1 ratio or more)
 * @param {Map} counts - Ion counts
 * @param {string} reagent - The reagent to check
 * @param {string} cation - The cation it's reacting with
 * @returns {boolean}
 */
export function hasExcess(counts, reagent, cation) {
  const reagentCount = counts.get(reagent) || 0;
  const cationCount = counts.get(cation) || 0;
  return reagentCount >= 2 * cationCount && cationCount > 0;
}

/**
 * Find all matching reactions for the ions present
 * @param {Set} ions - Set of ion identifiers present
 * @param {Map} counts - Ion counts for excess detection
 * @param {Object} reactionRules - Reaction rules from reactions.json
 * @returns {Array} Array of matched reaction results
 */
export function findReactions(ions, counts, reactionRules) {
  const results = [];
  const ionsArray = Array.from(ions);

  // Handle both nested structure (reactions.reactions) and flat structure
  const reactions = reactionRules?.reactions || reactionRules;

  // Check each ion against each other ion
  ionsArray.forEach(ion => {
    if (reactions[ion]) {
      const ionReactions = reactions[ion];
      ionsArray.forEach(otherIon => {
        if (ion !== otherIon && ionReactions[otherIon]) {
          const reaction = { ...ionReactions[otherIon] };
          reaction.cation = ion;
          reaction.reagent = otherIon;

          // Check for excess effect
          if (reaction.excess_effect && hasExcess(counts, otherIon, ion)) {
            reaction.isExcess = true;
          }

          results.push(reaction);
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
 * @returns {Object} Visual state
 */
export function calculateWellState(wellData, reactionRules, currentTime) {
  if (!wellData || !wellData.substances || wellData.substances.length === 0) {
    return null;
  }

  const { ions, counts } = collectIons(wellData.substances);
  const reactions = findReactions(ions, counts, reactionRules);
  const elapsed = currentTime - wellData.lastInteraction;

  // Default state
  const state = {
    color: null,
    solutionColor: null,
    precipitateColor: null,
    hasGas: false,
    gasDuration: 0,
    reactionType: null,
    smell: 'odorless',
    phLevel: 'neutral',
    reactions: reactions,
    notes: [],
    product: null,
    isTurbid: false,
    isDecolorized: false
  };

  // Process each reaction
  reactions.forEach(reaction => {
    // Check if we should use excess effect
    const effectiveReaction = reaction.isExcess && reaction.excess_effect
      ? { ...reaction, ...reaction.excess_effect }
      : reaction;

    // Handle gas evolution
    if (effectiveReaction.type === 'gas') {
      const duration = effectiveReaction.duration_ms || 6000;
      if (elapsed < duration) {
        state.hasGas = true;
        state.gasDuration = duration - elapsed;
      }
      if (effectiveReaction.smell) {
        state.smell = effectiveReaction.smell;
      }
      if (effectiveReaction.notes) state.notes.push(effectiveReaction.notes);
    }

    // Handle precipitates
    if (effectiveReaction.type === 'precipitate') {
      let color = effectiveReaction.color;

      // Check for time-dependent color change
      if (effectiveReaction.time_effect) {
        const delay = effectiveReaction.time_effect.delay_ms || 5000;
        if (elapsed > delay) {
          color = effectiveReaction.time_effect.change_to;
        }
      }

      state.precipitateColor = color;
      state.color = color;
      state.reactionType = 'precipitate';
      state.product = effectiveReaction.product;
      if (effectiveReaction.notes) state.notes.push(effectiveReaction.notes);
    }

    // Handle solution color changes (no precipitate, just solution color)
    if (effectiveReaction.type === 'solution') {
      let color = effectiveReaction.color;

      // Check for time-dependent color change
      if (effectiveReaction.time_effect) {
        const delay = effectiveReaction.time_effect.delay_ms || 5000;
        if (elapsed > delay) {
          color = effectiveReaction.time_effect.change_to;
        }
      }

      state.solutionColor = color;
      if (!state.precipitateColor) {
        state.color = color;
      }
      state.reactionType = state.reactionType || 'solution';
      if (effectiveReaction.notes) state.notes.push(effectiveReaction.notes);
    }

    // Handle complex formation (soluble colored products)
    if (effectiveReaction.type === 'complex') {
      state.solutionColor = effectiveReaction.color;
      state.color = effectiveReaction.color;
      state.reactionType = 'complex';
      state.product = effectiveReaction.product;
      if (effectiveReaction.notes) state.notes.push(effectiveReaction.notes);
    }

    // Handle mixed (both solution color and precipitate)
    if (effectiveReaction.type === 'mixed') {
      state.solutionColor = effectiveReaction.solution_color;
      state.precipitateColor = effectiveReaction.precipitate_color;
      state.color = effectiveReaction.precipitate_color || effectiveReaction.solution_color;
      state.reactionType = 'mixed';
      state.product = effectiveReaction.product;
      if (effectiveReaction.notes) state.notes.push(effectiveReaction.notes);
    }

    // Handle turbidity (cloudiness)
    if (effectiveReaction.type === 'turbidity') {
      state.isTurbid = true;
      state.color = effectiveReaction.color || 'white';
      state.reactionType = 'turbidity';
      if (effectiveReaction.notes) state.notes.push(effectiveReaction.notes);
    }

    // Handle decolorization
    if (effectiveReaction.type === 'decolorization') {
      state.isDecolorized = true;
      state.reactionType = 'decolorization';
      if (effectiveReaction.notes) state.notes.push(effectiveReaction.notes);
    }

    // Handle neutralization
    if (effectiveReaction.type === 'neutralization') {
      state.reactionType = 'neutralization';
      state.phLevel = 'neutral';
    }

    // Handle soluble (excess dissolved precipitate)
    if (effectiveReaction.type === 'soluble') {
      // Clear precipitate if it was dissolved
      if (state.precipitateColor && reaction.isExcess) {
        state.precipitateColor = null;
        state.color = effectiveReaction.color || null;
        state.reactionType = 'soluble';
      }
      if (effectiveReaction.notes) state.notes.push(effectiveReaction.notes);
    }
  });

  // Calculate pH based on ions present
  state.phLevel = calculatePh(ions, reactionRules);

  // Determine smell from reactions
  state.smell = determineSmell(ions, reactions, wellData.substances);

  return state;
}

/**
 * Calculate approximate pH based on ions present
 * @param {Set} ions - Set of ions present
 * @param {Object} reactionRules - For ph_responses lookup
 * @returns {string} 'acidic' | 'slightly-acidic' | 'neutral' | 'basic'
 */
export function calculatePh(ions, reactionRules) {
  const phResponses = reactionRules?.ph_responses || {};

  // Check specific pH responses first
  for (const ion of ions) {
    if (phResponses[ion]) {
      if (phResponses[ion] === 'acidic') return 'acidic';
      if (phResponses[ion] === 'basic') return 'basic';
      if (phResponses[ion] === 'slightly-acidic') return 'slightly-acidic';
    }
  }

  // Fallback to simple calculation
  const acidicIons = ['h+'];
  const basicIons = ['oh-', 'nh3', 'co3_2-'];

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
  // Check reactions for smell property
  for (const reaction of reactions) {
    if (reaction.smell) {
      return reaction.smell;
    }
  }

  // Check for H2S gas (acid + sulfide)
  if (ions.has('h+') && ions.has('s2-')) {
    return 'rotten-eggs';
  }

  // Check for NH3 (base + ammonium)
  if (ions.has('oh-') && ions.has('nh4+')) {
    return 'pungent';
  }

  // Check for SO2 (acid + sulfite)
  if (ions.has('h+') && ions.has('so3_2-')) {
    return 'sulfur-dioxide';
  }

  // Check for vinegar smell (acid + acetate)
  if (ions.has('h+') && ions.has('ch3coo-')) {
    return 'vinegar';
  }

  // Check for HCl (pungent when concentrated acid with chloride)
  if (ions.has('h+') && ions.has('cl-')) {
    return 'pungent';
  }

  return 'odorless';
}

/**
 * Get the color value for CSS styling
 * @param {string} colorName - Color name from reaction data
 * @returns {string} Tailwind color class
 */
export function getColorClass(colorName) {
  const colorMap = {
    // Whites and grays
    'white': 'bg-white',
    'cream': 'bg-amber-50',
    'gray': 'bg-gray-400',
    'black': 'bg-neutral-900',
    'colorless': 'bg-transparent',

    // Yellows
    'yellow': 'bg-yellow-300',
    'yellowish': 'bg-yellow-200',
    'pale-yellow': 'bg-yellow-100',
    'light-yellow': 'bg-yellow-100',
    'white-light-yellow': 'bg-yellow-50',
    'brown-yellow': 'bg-amber-400',

    // Oranges
    'orange': 'bg-orange-400',
    'yellow-orange': 'bg-orange-300',
    'orange-brown': 'bg-amber-600',

    // Reds
    'red': 'bg-red-500',
    'blood-red': 'bg-red-700',
    'brown-red': 'bg-red-800',
    'red-brown': 'bg-amber-700',
    'carmine-red': 'bg-red-600',
    'brick-red': 'bg-red-600',

    // Browns
    'brown': 'bg-amber-800',
    'yellow-brown': 'bg-amber-600',

    // Greens
    'green': 'bg-green-500',
    'light-green': 'bg-green-300',
    'olive-green': 'bg-lime-700',
    'green-brown': 'bg-lime-800',
    'green-white': 'bg-green-100',
    'yellow-green': 'bg-lime-400',

    // Blues
    'blue': 'bg-blue-500',
    'light-blue': 'bg-blue-300',
    'deep-blue': 'bg-blue-700',
    'dark-blue': 'bg-blue-900',
    'prussian-blue': 'bg-blue-900',
    'turquoise': 'bg-cyan-400',
    'teal': 'bg-teal-500',
    'bluer': 'bg-blue-500',
    'blue-green': 'bg-teal-500',

    // Purples and violets
    'violet': 'bg-violet-600',
    'pale-violet': 'bg-violet-300',
    'purple': 'bg-purple-600',
    'dark-purple': 'bg-purple-900',
    'blue-violet': 'bg-violet-500',

    // Pinks
    'pink': 'bg-pink-300',
    'pale-pink': 'bg-pink-100',

    // Special
    'reddish': 'bg-red-300',
  };

  return colorMap[colorName] || 'bg-gray-300';
}

/**
 * Get pH indicator color
 * @param {string} phLevel - pH level string
 * @returns {string} Tailwind color class
 */
export function getPhColor(phLevel) {
  const phColors = {
    'acidic': 'bg-red-500',
    'slightly-acidic': 'bg-orange-400',
    'neutral': 'bg-green-500',
    'basic': 'bg-indigo-700'
  };

  return phColors[phLevel] || 'bg-green-500';
}

/**
 * Get flame test color class
 * @param {string} flameColor - Flame color name
 * @returns {string} Tailwind color class
 */
export function getFlameColor(flameColor) {
  const flameColors = {
    'yellow': 'bg-yellow-400',
    'yellow-green': 'bg-lime-400',
    'green': 'bg-green-500',
    'blue-green': 'bg-teal-400',
    'brick-red': 'bg-red-500',
    'red': 'bg-red-600',
    'carmine-red': 'bg-red-700',
    'pale-violet': 'bg-violet-400',
    'violet': 'bg-violet-500',
  };

  return flameColors[flameColor] || 'bg-orange-400';
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
    // Normalize both guess and correct answer
    const normalizeFormula = (str) => {
      return (str || '')
        .toLowerCase()
        .replace(/\s/g, '')
        .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, m => '0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(m)])
        .replace(/[⁺⁻²³⁴]/g, ''); // Remove superscripts
    };

    const guess = normalizeFormula(guesses[label]);
    const correct = normalizeFormula(mapping[label].formula);

    const isCorrect = guess === correct;
    results[label] = isCorrect;
    if (!isCorrect) allCorrect = false;
  });

  return { results, win: allCorrect };
}
