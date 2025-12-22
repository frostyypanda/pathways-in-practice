# Virtual Spot Plate Lab (Qualitative Analysis)

An interactive chemistry lab simulation for qualitative analysis (spot plate/micro-scale analysis). The system uses an ion-based model to dynamically calculate chemical reactions, time-dependent effects, and physical properties.

## Features

### Core Functionality
- **5x5 Spot Plate Matrix**: Mix unknown solutions (A-E) in a spot plate grid
- **Ion-Based Reaction Engine**: Reactions calculated dynamically based on ions present (e.g., Ag⁺, Cl⁻, H⁺)
- **Multiple Problem Sets**: Different exercises for various skill levels

### Time-Dependent Effects
- **Gas Evolution**: CO₂ bubbles (acid + carbonate) fade after ~6 seconds
- **Photo Effect**: Silver salts (AgCl, AgI) darken after 10-15 seconds under light
- **Oxidation**: Fe(OH)₂ turns brown as Fe²⁺ oxidizes to Fe³⁺

### Tools
- **Pipette**: Select bottles A-E to dispense into wells
- **pH Paper**: Virtual indicator strip for pH testing (toggle)
- **Smell Test**: Detect characteristic odors (toggle)
- **Flame Test**: Observe flame colors for alkali/alkaline earth metals

### Visual Features
- **Contrast Mode**: Plate split black/white to show both light and dark precipitates
- **Real-time Animations**: Bubbles, color changes, precipitate formation

## Architecture

### Data-Logic Separation

All chemistry data is stored in JSON files, completely separate from the React UI code.

```
public/data/qualitative/
├── cations.json      # Cation properties (color, flame test, etc.)
├── reagents.json     # Reagent/test information
├── reactions.json    # Reaction matrix (cation + reagent → result)
└── problem_sets.json # Exercise configurations
```

### Component Structure

```
src/
├── pages/
│   └── Qualitative.jsx           # Main page
├── components/qualitative/
│   ├── SpotPlate.jsx             # 5x5 grid container
│   ├── Well.jsx                  # Individual well (handles click, display)
│   ├── Toolbox.jsx               # Tool selection UI
│   ├── LabProtocol.jsx           # Answer input panel
│   └── ProblemSetSelector.jsx    # Choose exercise
└── utils/
    └── ReactionEngine.js         # Pure logic - no React dependencies
```

## Data Schema

### cations.json
```json
{
  "cations": {
    "ag+": {
      "symbol": "Ag⁺",
      "name": "Silver",
      "inherent_color": "colorless",
      "flame_color": null
    }
  }
}
```

### reactions.json
```json
{
  "reactions": {
    "ag+": {
      "cl-": {
        "color": "white",
        "type": "precipitate",
        "product": "AgCl",
        "time_effect": {
          "change_to": "gray",
          "delay_ms": 10000,
          "trigger": "light"
        }
      }
    }
  }
}
```

### problem_sets.json
```json
{
  "problem_sets": {
    "classic_5": {
      "name": "Classic 5 Unknowns",
      "difficulty": "beginner",
      "bottles": [
        { "label": "A", "cation": "h+", "anion": "cl-", "formula": "HCl" }
      ],
      "available_reagents": ["oh-", "nh3"]
    }
  }
}
```

## Reaction Engine Logic

The `ReactionEngine.js` module is a pure JavaScript module with no React dependencies:

```javascript
// Calculate well state based on contents
function calculateWellState(wellContents, currentTime, reactionData) {
  // 1. Collect all ions from substances in the well
  // 2. Match against reaction rules
  // 3. Calculate time-dependent effects
  // 4. Return: { color, type, hasGas, smell, phLevel }
}
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `getIonsFromSubstance(substance)` | Extract cation/anion from a compound |
| `findMatchingReactions(ions, rules)` | Find applicable reaction rules |
| `calculateVisualState(reactions, elapsed)` | Compute current visual state |
| `getPhLevel(ions)` | Calculate approximate pH |

## Styling

Uses Tailwind CSS with custom chemistry-specific colors defined in `tailwind.config.js`:

```javascript
colors: {
  precipitate: {
    white: '#ffffff',
    yellow: '#fde047',
    'prussian-blue': '#1e3a5f',
    // ...
  }
}
```

## Adding New Content

### Adding a New Cation
1. Add entry to `public/data/qualitative/cations.json`
2. Add reaction entries to `reactions.json` for relevant reagents

### Adding a New Problem Set
1. Add entry to `public/data/qualitative/problem_sets.json`
2. Ensure all referenced cations/anions exist in other files

### Adding a New Reaction
1. Add to the appropriate cation's entry in `reactions.json`
2. Include: `color`, `type`, `product`, and optional `time_effect` or `notes`

## Future Enhancements

- [ ] Flame test visualization
- [ ] Concentration effects (dilute vs concentrated)
- [ ] Temperature controls (heating)
- [ ] Save/load experiment state
- [ ] Multiplayer/classroom mode
- [ ] More problem sets (organic qualitative analysis)
