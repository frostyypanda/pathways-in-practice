import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Pipette, ClipboardCheck, RotateCcw, FlaskConical,
  CheckCircle, XCircle, Wind, StickyNote, Trash2, Home, ChevronDown, Flame
} from 'lucide-react';
import {
  calculateWellState,
  getColorClass,
  getPhColor,
  getFlameColor,
  initializeGame,
  checkSolution
} from '../utils/ReactionEngine';

function Qualitative() {
  // Data from JSON files
  const [reactionRules, setReactionRules] = useState({});
  const [cationsData, setCationsData] = useState({});
  const [problemSets, setProblemSets] = useState({});
  const [currentProblemSet, setCurrentProblemSet] = useState(null);
  const [loading, setLoading] = useState(true);

  // Game state
  const [gameState, setGameState] = useState(null);
  const [grid, setGrid] = useState({});
  const [guesses, setGuesses] = useState({});
  const [results, setResults] = useState(null);

  // UI state
  const [activeTool, setActiveTool] = useState('pipette');
  const [selectedBottle, setSelectedBottle] = useState('A');
  const [now, setNow] = useState(Date.now());
  const [showProblemSelector, setShowProblemSelector] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Load data from JSON files
  useEffect(() => {
    const loadData = async () => {
      try {
        const [reactionsRes, problemSetsRes, cationsRes] = await Promise.all([
          fetch('/data/qualitative/reactions.json'),
          fetch('/data/qualitative/problem_sets.json'),
          fetch('/data/qualitative/cations.json')
        ]);

        const reactions = await reactionsRes.json();
        const problems = await problemSetsRes.json();
        const cations = await cationsRes.json();

        setReactionRules(reactions);
        setCationsData(cations.cations);
        setProblemSets(problems.problem_sets);

        // Start with generated_set by default (auto-generated with precipitate reactions)
        const defaultSet = problems.problem_sets['generated_set'];
        setCurrentProblemSet(defaultSet);
        initGame(defaultSet);

        setLoading(false);
      } catch (error) {
        console.error('Failed to load chemistry data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Global tick for time-dependent effects
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // Initialize game with a problem set
  const initGame = (problemSet) => {
    if (!problemSet) return;

    const game = initializeGame(problemSet);
    setGameState(game);
    setGrid({});

    // Initialize guesses for all labels
    const initialGuesses = {};
    game.labels.forEach(label => {
      initialGuesses[label] = '';
    });
    setGuesses(initialGuesses);
    setResults(null);
    setShowSolution(false);
    setSelectedBottle(game.labels[0]);
  };

  // Reset current game
  const resetGame = () => {
    if (currentProblemSet) {
      initGame(currentProblemSet);
    }
  };

  // Switch problem set
  const selectProblemSet = (setId) => {
    const problemSet = problemSets[setId];
    setCurrentProblemSet(problemSet);
    initGame(problemSet);
    setShowProblemSelector(false);
  };

  // Handle well click
  const handleWellClick = (row, col) => {
    if (results?.win || !gameState) return;

    const key = `${row}-${col}`;
    const current = grid[key] || {
      substances: [],
      phTested: false,
      smellTested: false,
      flameTested: false,
      lastInteraction: Date.now()
    };

    if (activeTool === 'pipette') {
      // Add the selected bottle's substance to the well
      const substance = gameState.mapping[selectedBottle];
      setGrid(prev => ({
        ...prev,
        [key]: {
          ...current,
          substances: [...current.substances, substance],
          lastInteraction: Date.now()
        }
      }));
    } else if (activeTool === 'ph') {
      if (current.substances.length === 0) return;
      setGrid(prev => ({
        ...prev,
        [key]: { ...current, phTested: !current.phTested }
      }));
    } else if (activeTool === 'nose') {
      if (current.substances.length === 0) return;
      setGrid(prev => ({
        ...prev,
        [key]: { ...current, smellTested: !current.smellTested }
      }));
    } else if (activeTool === 'flame') {
      if (current.substances.length === 0) return;
      setGrid(prev => ({
        ...prev,
        [key]: { ...current, flameTested: !current.flameTested }
      }));
    }
  };

  // Clear a well
  const clearWell = (row, col, e) => {
    e.stopPropagation();
    const newGrid = { ...grid };
    delete newGrid[`${row}-${col}`];
    setGrid(newGrid);
  };

  // Check solution
  const handleCheckSolution = () => {
    if (!gameState) return;
    const result = checkSolution(guesses, gameState.mapping);
    setResults(result);
  };

  // Get smell display text
  const getSmellText = (smell) => {
    const smellMap = {
      'odorless': 'Odorless',
      'pungent': 'Pungent',
      'rotten-eggs': 'Rotten Eggs',
      'vinegar': 'Vinegar',
      'sulfur-dioxide': 'SO₂ (Sulfur)'
    };
    return smellMap[smell] || smell;
  };

  // Get flame test result for a well's substances
  const getFlameTestResult = (substances) => {
    for (const substance of substances) {
      const cation = substance.cation;
      if (cation && cationsData[cation]) {
        const flameColor = cationsData[cation].flame_color;
        if (flameColor) {
          return {
            color: flameColor,
            cationName: cationsData[cation].name
          };
        }
      }
    }
    return null;
  };

  // Color mixing map for combining solution colors
  const colorMixMap = {
    'light-blue+orange': 'olive-green',
    'light-blue+light-green': 'turquoise',
    'light-blue+pink': 'purple',
    'light-blue+green': 'teal',
    'orange+light-green': 'yellow-brown',
    'orange+pink': 'brown',
    'orange+green': 'brown',
    'light-green+pink': 'gray',
    'light-green+orange': 'yellow-brown',
    'pink+light-green': 'gray',
    'pink+orange': 'brown',
    'green+pink': 'gray',
    'green+orange': 'brown',
  };

  // Get mixed color from two colors
  const mixColors = (color1, color2) => {
    if (!color1) return color2;
    if (!color2) return color1;
    if (color1 === color2) return color1;

    // Try both orderings in the map
    const key1 = `${color1}+${color2}`;
    const key2 = `${color2}+${color1}`;
    return colorMixMap[key1] || colorMixMap[key2] || 'brown'; // Default to brown for unknown mixes
  };

  // Get inherent solution color from cations in the well (with mixing)
  const getInherentSolutionColor = (substances) => {
    const colors = [];
    for (const substance of substances) {
      const cation = substance.cation;
      if (cation && cationsData[cation]) {
        const inherentColor = cationsData[cation].inherent_color;
        if (inherentColor && inherentColor !== 'colorless' && !colors.includes(inherentColor)) {
          colors.push(inherentColor);
        }
      }
    }

    if (colors.length === 0) return null;
    if (colors.length === 1) return colors[0];

    // Mix multiple colors together
    let mixed = colors[0];
    for (let i = 1; i < colors.length; i++) {
      mixed = mixColors(mixed, colors[i]);
    }
    return mixed;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading chemistry data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 font-sans text-slate-100">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-400 hover:text-white transition-colors">
              <Home size={24} />
            </Link>
            <FlaskConical className="text-indigo-400 shrink-0" size={36} />
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">
                Virtual Spot Plate Lab
              </h1>
              <p className="text-slate-400 text-sm">Ion-based qualitative analysis simulation</p>
            </div>
          </div>

          {/* Problem Set Selector */}
          <div className="relative">
            <button
              onClick={() => setShowProblemSelector(!showProblemSelector)}
              className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 hover:border-indigo-500 transition-colors"
            >
              <span className="text-sm font-medium">{currentProblemSet?.name || 'Select Exercise'}</span>
              <ChevronDown size={16} />
            </button>

            {showProblemSelector && (
              <div className="absolute right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 min-w-64">
                {Object.values(problemSets).map(ps => (
                  <button
                    key={ps.id}
                    onClick={() => selectProblemSet(ps.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                      currentProblemSet?.id === ps.id ? 'bg-indigo-600/20 border-l-2 border-indigo-500' : ''
                    }`}
                  >
                    <div className="font-medium">{ps.name}</div>
                    <div className="text-xs text-slate-400">{ps.description}</div>
                    <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                      ps.difficulty === 'beginner' ? 'bg-green-600/30 text-green-400' :
                      ps.difficulty === 'intermediate' ? 'bg-yellow-600/30 text-yellow-400' :
                      'bg-red-600/30 text-red-400'
                    }`}>
                      {ps.difficulty}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Toolbox */}
        <div className="flex flex-wrap gap-2 bg-slate-800 p-3 rounded-xl mb-6 border border-slate-700">
          {/* Bottle Selection */}
          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
            {gameState?.labels.map(label => (
              <button
                key={label}
                onClick={() => { setSelectedBottle(label); setActiveTool('pipette'); }}
                className={`w-10 h-10 rounded-lg font-bold transition-all ${
                  selectedBottle === label && activeTool === 'pipette'
                    ? 'bg-indigo-600 text-white shadow-lg scale-105'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="w-px bg-slate-700 mx-2"></div>

          {/* Tools */}
          <button
            onClick={() => setActiveTool('ph')}
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'ph' ? 'bg-amber-500 text-white shadow-md' : 'hover:bg-slate-700 text-slate-400'
            }`}
            title="pH Paper"
          >
            <StickyNote size={20} />
          </button>
          <button
            onClick={() => setActiveTool('nose')}
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'nose' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-700 text-slate-400'
            }`}
            title="Smell Test"
          >
            <Wind size={20} />
          </button>
          <button
            onClick={() => setActiveTool('flame')}
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'flame' ? 'bg-orange-500 text-white shadow-md' : 'hover:bg-slate-700 text-slate-400'
            }`}
            title="Flame Test"
          >
            <Flame size={20} />
          </button>

          <div className="w-px bg-slate-700 mx-2"></div>

          <button
            onClick={resetGame}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            title="Reset"
          >
            <RotateCcw size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

          {/* Spot Plate */}
          <div className="xl:col-span-7">
            <div className="bg-slate-800 p-4 md:p-8 rounded-3xl border border-slate-700 shadow-xl">
              <div className="overflow-x-auto">
                <table className="border-separate border-spacing-2 mx-auto">
                  <thead>
                    <tr>
                      <th className="w-10"></th>
                      {[1, 2, 3, 4, 5].map(n => (
                        <th key={n} className="w-16 h-10 text-xl font-bold text-slate-500">{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map(row => (
                      <tr key={row}>
                        <td className="text-xl font-bold text-slate-500 text-center">{row}</td>
                        {[1, 2, 3, 4, 5].map(col => {
                          const cell = grid[`${row}-${col}`];
                          const state = cell ? calculateWellState(cell, reactionRules, now) : null;

                          return (
                            <td key={col} className="p-0">
                              <button
                                onClick={() => handleWellClick(row, col)}
                                style={{
                                  background: 'linear-gradient(90deg, #ffffff 50%, #1a1a1a 50%)'
                                }}
                                className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-4 relative group overflow-hidden shadow-inner transition-all duration-300 ${
                                  cell ? 'border-slate-500' : 'border-slate-600 border-dashed hover:border-indigo-400'
                                }`}
                              >
                                {cell && state ? (
                                  <div className="absolute inset-0 flex flex-col justify-end">
                                    {/* Solution color tint - use reaction color or inherent cation color */}
                                    {(() => {
                                      const solutionColor = state.solutionColor && state.solutionColor !== 'colorless'
                                        ? state.solutionColor
                                        : getInherentSolutionColor(cell.substances);
                                      return (
                                        <div
                                          className={`absolute inset-0 z-10 transition-all duration-[3000ms] ${
                                            solutionColor
                                              ? `${getColorClass(solutionColor)} opacity-50`
                                              : 'bg-blue-400/10'
                                          }`}
                                        ></div>
                                      );
                                    })()}

                                    {/* Gas bubbles */}
                                    {state.hasGas && (
                                      <div className="absolute inset-0 z-20 flex flex-wrap justify-center items-center p-4 gap-1">
                                        {[...Array(5)].map((_, i) => (
                                          <div
                                            key={i}
                                            className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce"
                                            style={{ animationDelay: `${i * 0.1}s` }}
                                          />
                                        ))}
                                      </div>
                                    )}

                                    {/* Precipitate */}
                                    {state.precipitateColor && state.precipitateColor !== 'colorless' && (
                                      <div
                                        className={`z-30 w-full h-1/3 ${getColorClass(state.precipitateColor)} border-t border-black/20 opacity-95 rounded-b-full shadow-lg transition-all duration-[3000ms]`}
                                      />
                                    )}

                                    {/* pH Paper */}
                                    {cell.phTested && (
                                      <div className="absolute inset-x-0 top-2 z-40 flex justify-center">
                                        <div className={`w-3 h-8 rounded-sm shadow-md ${getPhColor(state.phLevel)} border border-black/20`}></div>
                                      </div>
                                    )}

                                    {/* Smell indicator */}
                                    {cell.smellTested && (
                                      <div className="absolute inset-x-0 bottom-1 z-40 flex justify-center">
                                        <div className="bg-white/95 shadow-md border px-1.5 py-0.5 rounded-full text-[8px] font-bold flex items-center gap-1 text-slate-800">
                                          <Wind size={8} className="text-emerald-600" />
                                          {getSmellText(state.smell)}
                                        </div>
                                      </div>
                                    )}

                                    {/* Flame test indicator */}
                                    {cell.flameTested && (() => {
                                      const flameResult = getFlameTestResult(cell.substances);
                                      return flameResult ? (
                                        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                          <div className="flex flex-col items-center">
                                            <div className={`w-6 h-8 ${getFlameColor(flameResult.color)} rounded-t-full opacity-80 animate-flicker shadow-lg`}></div>
                                            <div className="bg-slate-900/90 text-white text-[7px] px-1.5 py-0.5 rounded mt-0.5 font-bold whitespace-nowrap">
                                              {flameResult.color.replace('-', ' ')}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                          <div className="bg-slate-900/90 text-slate-400 text-[8px] px-2 py-1 rounded font-bold">
                                            No flame color
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Clear button */}
                                    <div
                                      onClick={(e) => clearWell(row, col, e)}
                                      className="absolute top-1 right-1 z-50 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 transition-opacity cursor-pointer"
                                    >
                                      <Trash2 size={10} />
                                    </div>
                                  </div>
                                ) : (
                                  <Pipette className="absolute inset-0 m-auto text-slate-300 opacity-20 group-hover:text-indigo-400 group-hover:opacity-50" size={16} />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Lab Protocol / Answer Panel */}
          <div className="xl:col-span-5 space-y-4">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
              <h3 className="text-lg font-bold mb-4 text-slate-200 flex items-center gap-2 uppercase tracking-wide">
                <ClipboardCheck className="text-indigo-400" size={20} />
                Lab Protocol
              </h3>

              <div className="grid gap-3">
                {gameState?.labels.map(label => (
                  <div
                    key={label}
                    className={`flex items-center gap-3 p-3 bg-slate-900 rounded-xl border transition-all ${
                      results
                        ? results.results[label]
                          ? 'border-green-500/50'
                          : 'border-red-500/50'
                        : 'border-slate-700 focus-within:border-indigo-500'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                      {label}
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="e.g. AgNO3"
                        value={guesses[label] || ''}
                        onChange={(e) => setGuesses(prev => ({ ...prev, [label]: e.target.value }))}
                        disabled={results?.win}
                        className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:border-indigo-500 outline-none transition-all text-white placeholder-slate-500"
                      />
                      {results && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {results.results[label]
                            ? <CheckCircle className="text-green-500" size={18} />
                            : <XCircle className="text-red-500" size={18} />
                          }
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCheckSolution}
                  disabled={results?.win}
                  className={`flex-1 py-4 rounded-xl font-bold uppercase tracking-wide text-white transition-all ${
                    results?.win
                      ? 'bg-green-600 cursor-default'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98'
                  }`}
                >
                  {results?.win ? 'Solved!' : 'Verify Analysis'}
                </button>
                <button
                  onClick={() => setShowSolution(!showSolution)}
                  className={`px-4 py-4 rounded-xl font-bold uppercase tracking-wide transition-all ${
                    showSolution
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                  title="Show Solution"
                >
                  {showSolution ? 'Hide' : 'Reveal'}
                </button>
              </div>

              {/* Solution reveal */}
              {showSolution && gameState && (
                <div className="mt-4 p-4 bg-amber-900/30 border border-amber-600/50 rounded-xl">
                  <h4 className="text-sm font-bold text-amber-400 mb-3 uppercase tracking-wide">Solution</h4>
                  <div className="grid gap-2">
                    {gameState.labels.map(label => (
                      <div key={label} className="flex items-center gap-3 text-sm">
                        <span className="w-8 h-8 rounded bg-amber-600 text-white flex items-center justify-center font-bold">
                          {label}
                        </span>
                        <span className="font-mono text-amber-200">
                          {gameState.mapping[label].formula}
                        </span>
                        <span className="text-slate-400">
                          ({gameState.mapping[label].name})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Hints */}
            {currentProblemSet?.hints && (
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Hints</h4>
                <ul className="text-xs text-slate-500 space-y-1">
                  {currentProblemSet.hints.map((hint, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-indigo-400">•</span>
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce {
          animation: bounce 0.6s infinite ease-in-out;
        }
        @keyframes flicker {
          0%, 100% { opacity: 0.8; transform: scaleY(1); }
          25% { opacity: 0.9; transform: scaleY(1.05); }
          50% { opacity: 0.7; transform: scaleY(0.95); }
          75% { opacity: 0.85; transform: scaleY(1.02); }
        }
        .animate-flicker {
          animation: flicker 0.3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default Qualitative;
