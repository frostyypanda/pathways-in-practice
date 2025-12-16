import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataManager } from '../utils/DataManager';
import SequencePlayer from '../components/SequencePlayer';
import QuizControls from '../components/QuizControls';
import { ArrowLeft } from 'lucide-react';
import useDeviceDetection from '../hooks/useDeviceDetection';

// Parse hash like "#step-5.1.2" into [4, 0, 1] (0-indexed)
const parseStepHash = () => {
    const hash = window.location.hash;
    const match = hash.match(/^#step-(.+)$/);
    if (!match) return null;

    const parts = match[1].split('.').map(n => parseInt(n, 10) - 1); // Convert to 0-indexed
    if (parts.some(isNaN)) return null;
    return parts;
};

// Build hash from navigationStack and currentStepIndex
const buildStepHash = (navigationStack, currentStepIndex) => {
    const parts = navigationStack.map(frame => frame.stepIndex + 1); // Convert to 1-indexed
    parts.push(currentStepIndex + 1);
    return `#step-${parts.join('.')}`;
};

const Synthesis = () => {
    const { id } = useParams();
    const deviceState = useDeviceDetection();
    const isLandscape = deviceState === 'MOBILE_LANDSCAPE';
    const [synthesis, setSynthesis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [quizSettings, setQuizSettings] = useState(() => {
        const saved = localStorage.getItem('openSynth_quizSettings');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            reactant: true,
            name: true,
            conditions: true,
            product: true,
            notes: true
        };
    });

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    // Navigation stack for substeps: each entry is { sequence, stepIndex }
    const [navigationStack, setNavigationStack] = useState([]);
    // Track if we've initialized from hash to avoid updating hash during initial load
    const [hashInitialized, setHashInitialized] = useState(false);

    const toggleQuizSetting = (id) => {
        setQuizSettings(prev => {
            const newSettings = {
                ...prev,
                [id]: !prev[id]
            };
            localStorage.setItem('openSynth_quizSettings', JSON.stringify(newSettings));
            return newSettings;
        });
    };

    // Get current sequence based on navigation stack
    const getCurrentSequence = () => {
        if (navigationStack.length === 0) {
            return synthesis?.sequence || [];
        }
        // Navigate through the stack to get the current substeps sequence
        let currentSeq = synthesis?.sequence || [];
        for (const frame of navigationStack) {
            const step = currentSeq[frame.stepIndex];
            if (step?.substeps) {
                currentSeq = step.substeps;
            }
        }
        return currentSeq;
    };

    const isInSubsteps = navigationStack.length > 0;

    const enterSubsteps = (substeps) => {
        // Push current state to stack and reset step index for substeps
        setNavigationStack(prev => [...prev, { stepIndex: currentStepIndex }]);
        setCurrentStepIndex(0);
    };

    const exitSubsteps = () => {
        if (navigationStack.length > 0) {
            const newStack = [...navigationStack];
            const lastFrame = newStack.pop();
            setNavigationStack(newStack);
            setCurrentStepIndex(lastFrame.stepIndex);
        }
    };

    useEffect(() => {
        const loadSynthesis = async () => {
            // Find the path from the index first
            const index = await DataManager.getAllSyntheses();
            const meta = index.find(item => item.id === id);

            if (meta) {
                const data = await DataManager.getSynthesis(meta.path);
                setSynthesis(data);

                // Restore position from hash after data loads
                const hashPath = parseStepHash();
                if (hashPath && hashPath.length > 0 && data?.sequence) {
                    // Validate and apply the path
                    let currentSeq = data.sequence;
                    const newStack = [];
                    let valid = true;

                    // Navigate through all but the last index (those go into navigationStack)
                    for (let i = 0; i < hashPath.length - 1 && valid; i++) {
                        const idx = hashPath[i];
                        if (idx >= 0 && idx < currentSeq.length && currentSeq[idx]?.substeps) {
                            newStack.push({ stepIndex: idx });
                            currentSeq = currentSeq[idx].substeps;
                        } else {
                            valid = false;
                        }
                    }

                    // Last index is the currentStepIndex
                    const lastIdx = hashPath[hashPath.length - 1];
                    if (valid && lastIdx >= 0 && lastIdx < currentSeq.length) {
                        setNavigationStack(newStack);
                        setCurrentStepIndex(lastIdx);
                    }
                }
            }
            setLoading(false);
            setHashInitialized(true);
        };
        loadSynthesis();
    }, [id]);

    // Update hash when step position changes
    useEffect(() => {
        if (hashInitialized) {
            const newHash = buildStepHash(navigationStack, currentStepIndex);
            // Use replaceState to avoid polluting browser history with every step
            window.history.replaceState(null, '', newHash);
        }
    }, [currentStepIndex, navigationStack, hashInitialized]);

    if (loading) return <div className="loading">Loading synthesis...</div>;
    if (!synthesis) return <div className="error">Synthesis not found.</div>;

    const currentSequence = getCurrentSequence();
    const totalSteps = currentSequence.length;

    return (
        <div className="synthesis-page">
            <header className="synthesis-header compact-header">
                <div className="header-split">
                    {isInSubsteps ? (
                        <button onClick={exitSubsteps} className="back-link">
                            <ArrowLeft size={16} /> Back to Parent Step
                        </button>
                    ) : (
                        <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to Library</Link>
                    )}
                    {totalSteps > 0 && <span className="step-counter">Step {currentStepIndex + 1} / {totalSteps}</span>}
                    {!isInSubsteps && <h1 className="compact-title">{synthesis.meta.molecule_name}</h1>}
                </div>
            </header>

            <QuizControls settings={quizSettings} onToggle={toggleQuizSetting} />
            <SequencePlayer
                key={id}
                sequence={currentSequence}
                synthesis={synthesis}
                quizSettings={quizSettings}
                currentStepIndex={currentStepIndex}
                setCurrentStepIndex={setCurrentStepIndex}
                isLandscape={isLandscape}
                isInSubsteps={isInSubsteps}
                onEnterSubsteps={enterSubsteps}
                onExitSubsteps={exitSubsteps}
            />
        </div>
    );
};

export default Synthesis;
