import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataManager } from '../utils/DataManager';
import SequencePlayer from '../components/SequencePlayer';
import QuizControls from '../components/QuizControls';
import { ArrowLeft } from 'lucide-react';
import useDeviceDetection from '../hooks/useDeviceDetection';

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
            }
            setLoading(false);
        };
        loadSynthesis();
    }, [id]);

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
