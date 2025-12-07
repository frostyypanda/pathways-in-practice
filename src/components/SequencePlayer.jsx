import React, { useState, useEffect } from 'react';
import MoleculeCanvas from './MoleculeCanvas';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

const SequencePlayer = ({ synthesis, quizSettings }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [revealedParts, setRevealedParts] = useState({});

    // Reset revealed parts when step changes
    useEffect(() => {
        setRevealedParts({});
    }, [currentStepIndex]);

    if (!synthesis || !synthesis.sequence || synthesis.sequence.length === 0) {
        return <div>No synthesis data available.</div>;
    }

    const currentStep = synthesis.sequence[currentStepIndex];
    const totalSteps = synthesis.sequence.length;

    const handleNext = () => {
        if (currentStepIndex < totalSteps - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(currentStepIndex - 1);
        }
    };

    const isVisible = (partId) => {
        // Visible if quiz setting is false (not hidden) OR if explicitly revealed
        return !quizSettings?.[partId] || revealedParts[partId];
    };

    const reveal = (partId) => {
        if (quizSettings?.[partId] && !revealedParts[partId]) {
            setRevealedParts(prev => ({ ...prev, [partId]: true }));
        }
    };

    const renderQuizContent = (partId, content, className = "") => {
        if (isVisible(partId)) {
            return content;
        }
        return (
            <div
                className={`quiz-hidden-placeholder ${className}`}
                onClick={() => reveal(partId)}
                title="Click to reveal"
            />
        );
    };

    return (
        <div className="sequence-player">
            <div className="player-header">
                <h2>Step {currentStep.step_id} / {totalSteps}</h2>
                {renderQuizContent('name', <p className="reaction-type">{currentStep.reaction_type}</p>)}
            </div>

            <div className="reaction-container">
                <div className="molecule-block">
                    {renderQuizContent('reactant',
                        <MoleculeCanvas smiles={currentStep.reactant_smiles} width={300} height={250} />
                    )}
                </div>

                <div className="reaction-arrow">
                    {renderQuizContent('conditions', (
                        <>
                            <div className="reagents">{currentStep.reagents}</div>
                            <div className="arrow-line">
                                <ArrowRight size={48} />
                            </div>
                            <div className="conditions">{currentStep.conditions}</div>
                            <div className="yield">{currentStep.yield} yield</div>
                        </>
                    ))}
                </div>

                <div className="molecule-block">
                    {renderQuizContent('product',
                        <MoleculeCanvas smiles={currentStep.product_smiles} width={300} height={250} />
                    )}
                </div>
            </div>

            <div className="player-controls">
                <button onClick={handlePrev} disabled={currentStepIndex === 0} className="control-btn">
                    <ChevronLeft /> Previous
                </button>
                <div className="notes">
                    {renderQuizContent('notes', <p>{currentStep.notes}</p>)}
                </div>
                <button onClick={handleNext} disabled={currentStepIndex === totalSteps - 1} className="control-btn">
                    Next <ChevronRight />
                </button>
            </div>
        </div>
    );
};

export default SequencePlayer;
