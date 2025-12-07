# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Interaction Style

**IMPORTANT**: When the user asks a question (e.g., "could we do X?", "is it possible to Y?"), ANSWER THE QUESTION FIRST. Do not immediately start implementing, writing scripts, or making changes. Explain the options, feasibility, and tradeoffs, then wait for confirmation before proceeding.

## Project Overview

OpenSynth is an offline-first React PWA for viewing and studying organic chemistry total syntheses. It uses a "Git-as-Database" architecture where all synthesis data is stored as JSON files in the repository.

## Commands

```bash
npm run dev       # Start development server (Vite)
npm run build     # Production build
npm run lint      # Run ESLint
npm run preview   # Preview production build

# Data import from Open Reaction Database
npm run data:import   # Runs python3 scripts/data_ingestion/fetch_real_ord_data.py
```

## Architecture

### Data Flow
- `public/data/index.json` - Master index listing all available syntheses with metadata
- `public/data/{class}/{molecule_author_year}.json` - Individual synthesis files organized by molecule class (alkaloids, terpenes, pharmaceuticals, imported)
- `public/data/schema.json` - JSON schema defining the synthesis data structure

### Core Components
- **MoleculeCanvas** (`src/components/MoleculeCanvas.jsx`) - Renders SMILES strings to canvas using the `smiles-drawer` library (loaded via CDN in index.html as `window.SmilesDrawer`). Uses `React.memo` to prevent unnecessary re-renders.
- **SequencePlayer** (`src/components/SequencePlayer.jsx`) - Step-by-step reaction viewer with Previous/Next navigation. Handles quiz mode where parts can be hidden and revealed on click.
- **QuizControls** (`src/components/QuizControls.jsx`) - Toggles for hiding/showing reactant, product, conditions, name, and notes
- **DataManager** (`src/utils/DataManager.js`) - Fetches synthesis data from `/data` directory

### Pages
- **Home** (`src/pages/Home.jsx`) - Search and filter syntheses by molecule name, author, and step count
- **Synthesis** (`src/pages/Synthesis.jsx`) - Individual synthesis view with the sequence player

### Routing
Routes defined in `src/App.jsx`:
- `/` - Home page with synthesis library
- `/synthesis/:id` - Individual synthesis viewer (id matches `meta.id` in synthesis JSON)

### PWA Support
Configured via `vite-plugin-pwa` in `vite.config.js`. Service workers cache all JSON data for offline use.

## Data Schema

Synthesis JSON files follow this structure:
```json
{
  "meta": {
    "id": "molecule-author-year",
    "molecule_name": "Name",
    "class": "Alkaloid|Terpene|Pharmaceutical",
    "author": "Author Name",
    "year": 2024,
    "journal": "Journal Name",
    "doi": "10.xxxx/..."
  },
  "sequence": [
    {
      "step_id": 1,
      "reaction_type": "Reaction Name",
      "reagents": "Reagent list",
      "conditions": "Temp, time, etc.",
      "yield": "95%",
      "reactant_smiles": "SMILES string",
      "product_smiles": "SMILES string",
      "notes": "Optional notes"
    }
  ]
}
```

## Quiz Mode

Quiz settings are persisted to localStorage under `openSynth_quizSettings`. When a part is hidden, clicking the placeholder reveals it.
