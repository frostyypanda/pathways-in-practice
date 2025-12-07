This is a comprehensive Product Requirements Document (PRD) for OpenSynth.This document is designed to be handed directly to a developer or used as the README.md for your GitHub repository. It focuses on the "Git-as-Database" architecture you requested.Product Requirements Document: OpenSynthProject NameOpenSynthVersion1.0.0StatusApproved for DevelopmentCore ConceptA community-driven, offline-first library of chemical total syntheses powered by React and GitHub.Repository TypeMonorepo (Code + Data in one place)1. Executive SummaryOpenSynth is an open-source educational platform for organic chemists. Unlike proprietary apps, it stores all chemical data (reactions, molecules, citations) as JSON files in a public Git repository.Key Value Propositions:Community Driven: Anyone can add a new synthesis pathway by submitting a Pull Request (PR).Lightweight & Fast: Uses SMILES strings instead of images. The app renders chemical structures dynamically in the browser.100% Offline Capable: Built as a Progressive Web App (PWA). Once loaded, it works without internet.Git-Backed History: Every correction, addition, or change is version-controlled by Git.2. User Roles & Flows2.1 The "Student" (Consumer)Goal: Study the total synthesis of Taxol while on a flight (offline).Flow: Opens app -> Search "Taxol" -> Selects "Nicolaou (1994)" route -> Enters "Player Mode" -> Taps "Next" to see the ring-closing reaction.Requirement: App must cache all JSON data and the rendering engine locally.2.2 The "Contributor" (Creator)Goal: Add the recent synthesis of Koumine by Takayama.Flow: Forks the repo -> Creates a new file data/alkaloids/koumine_takayama.json -> Pastes the SMILES strings for each step -> Submits Pull Request.Requirement: The data format must be human-readable and easy to validate.3. Data Architecture (The "Git Database")The database is simply a folder structure of .json files. No SQL, no Firebase.3.1 Directory StructurePlaintext/public
  /data
    /index.json           <-- Master list (Generated via script or maintained manually)
    /alkaloids
      koumine_takayama_2015.json
      strychnine_woodward_1954.json
    /terpenes
      taxol_nicolaou_1994.json
      taxol_holton_1994.json
3.2 The JSON Schema (SynthesisRoute)Every file represents one unique synthesis route.JSON{
  "$schema": "./schema.json",
  "meta": {
    "id": "koumine-takayama-2015",
    "molecule_name": "Koumine",
    "class": "Alkaloid",
    "author": "Takayama, H.",
    "year": 2015,
    "journal": "Org. Lett.",
    "doi": "10.1021/acs.orglett.5b02138",
    "patent_url": "Optional link to Google Patents/Espacenet"
  },
  "sequence": [
    {
      "step_id": 1,
      "reaction_type": "Epoxide Opening",
      "reagents": "BnNH2, H2O",
      "conditions": "Reflux, 12h",
      "yield": "95%",
      "reactant_smiles": "C1OC1...", 
      "product_smiles": "NC(Cc1ccccc1)...",
      "notes": "Regioselective opening of the epoxide."
    }
  ]
}
4. Technical Architecture4.1 Tech StackFramework: React (Create React App or Vite)Rendering Engine: smiles-drawer (Canvas-based rendering of SMILES strings).State Management: React Context API (Sufficient for read-only data).Routing: react-router-dom.Offline: Service Workers (workbox) to cache the JSON data and assets.4.2 Core ComponentsA. MoleculeCanvas.jsInput: smiles string, width, height.Logic: Uses SmilesDrawer to draw the black-and-white structure.Optimization: Must use React.memo to prevent re-drawing if the SMILES string hasn't changed.B. SequencePlayer.jsLogic:Holds currentStepIndex state.Renders two MoleculeCanvas components: one for Reactant, one for Product.Renders a central "Arrow Block" containing Reagents/Conditions.Pre-fetches the next step's SMILES to ensure smooth "Next" button performance.C. DataManager.js (Utility)Logic:On app launch, fetches /data/index.json.Lazy-loads specific synthesis files only when the user clicks them.Offline Fallback: If fetch fails, try to load from localStorage or Service Worker cache.5. Contribution Workflow (Governance)This is how you maintain quality without doing all the work yourself.Validation Script: Add a GitHub Action that runs on every PR.It parses the new JSON file.Checks if reactant_smiles and product_smiles are valid SMILES (using a node script with rdkit or openchemlib).Pass/Fail: If invalid, the PR check turns red.Formatting: The script ensures the JSON is prettified so diffs are readable.Merge: Once you (the maintainer) click "Merge", the new synthesis is live for everyone immediately (or upon next deployment).6. Implementation Plan (Phase 1)Week 1: The ShellInitialize React repo.Install smiles-drawer and lucide-react (icons).Create the MoleculeCanvas component and test it with a hardcoded Benzene ring.Week 2: The LogicBuild the SequencePlayer component (Previous/Next buttons).Create the "Reaction Arrow" UI (Reactant -> Reagents -> Product).Set up the JSON file loading logic.Week 3: Data & PolishAdd 5 "Golden Standard" syntheses (Strychnine, Taxol, Aspirin, etc.) manually to public/data.Implement the Service Worker for offline support.Deploy to GitHub Pages.7. Future Proofing (Scalability)Search: When the library grows to 500+ files, client-side search (loading all JSONs) will be too slow.Solution: Generate a lightweight search_index.json during the build process that only contains names and IDs.Substructure Search: "Find all reactions that make an indole ring."Solution: This requires a WebAssembly version of RDKit (rdkit-js) running in the browser. (Out of scope for V1, but technically possible).