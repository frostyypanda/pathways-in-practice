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

    const totalSteps = synthesis.sequence ? synthesis.sequence.length : 0;

    return (
        <div className="synthesis-page">
            <header className="synthesis-header compact-header">
                <div className="header-split">
                    <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to Library</Link>
                    {totalSteps > 0 && <span className="step-counter">Step {currentStepIndex + 1} / {totalSteps}</span>}
                    <h1 className="compact-title">{synthesis.meta.molecule_name}</h1>
                </div>
            </header>

            <QuizControls settings={quizSettings} onToggle={toggleQuizSetting} />
            <SequencePlayer
                synthesis={synthesis}
                quizSettings={quizSettings}
                currentStepIndex={currentStepIndex}
                setCurrentStepIndex={setCurrentStepIndex}
                isLandscape={isLandscape}
            />
        </div>
    );
};

export default Synthesis;
