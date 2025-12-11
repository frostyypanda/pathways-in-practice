import React, { useState, useEffect } from 'react';
import MoleculeCanvas from './MoleculeCanvas';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import OrganicArrow from './OrganicArrow';

const SequencePlayer = ({ synthesis, quizSettings, currentStepIndex, setCurrentStepIndex, isLandscape }) => {
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

    // Adjust canvas dimensions for landscape
    const canvasWidth = isLandscape ? 200 : 300;
    const canvasHeight = isLandscape ? 120 : 250;
    const reagentWidth = isLandscape ? 130 : 150;
    const reagentHeight = isLandscape ? 60 : 80;

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

    const renderQuizContent = (partId, content, sizeClass = "size-large") => {
        const isRev = isVisible(partId);
        return (
            <div className={`quiz-box-wrapper ${sizeClass}`}>
                {isRev ? (
                    <div className="quiz-content-revealed">{content}</div>
                ) : (
                    <div
                        className="quiz-hidden-placeholder"
                        onClick={() => reveal(partId)}
                        title="Click to reveal"
                    />
                )}
            </div>
        );
    };

    return (
        <div className="sequence-player">
            {/* Header moved to parent */}

            <div className="reaction-container">
                <div className="molecule-block">
                    {renderQuizContent('reactant', (
                        <div className="molecule-canvas-container">
                            <MoleculeCanvas smiles={currentStep.reactant_smiles} width={canvasWidth} height={canvasHeight} showPlusSeparator={currentStep.reactant_split_by_plus} />
                        </div>
                    ), 'size-large')}
                </div>

                <div className="reaction-arrow">
                    {renderQuizContent('conditions', (
                        <div className="arrow-content-wrapper">
                            <div className="reagents-structures-group">
                                {currentStep.reagent_smiles && (
                                    <div className="reagent-structures" style={{ display: 'flex', justifyContent: 'center' }}>
                                        <MoleculeCanvas smiles={currentStep.reagent_smiles} width={reagentWidth} height={reagentHeight} showPlusSeparator={currentStep.reagent_split_by_plus} />
                                    </div>
                                )}
                            </div>
                            <div className="reagents-text-group">
                                <div className="reagents">{currentStep.reagents}</div>
                            </div>
                            <div className="arrow-group">
                                <div className="conditions">{currentStep.conditions}</div>
                                <div className="arrow-line">
                                    <OrganicArrow width={isLandscape ? 80 : 105} />
                                </div>
                                <div className="yield">{currentStep.yield} yield</div>
                            </div>
                        </div>
                    ), 'size-medium')}
                </div>

                <div className="molecule-block">
                    {renderQuizContent('product', (
                        <div className="molecule-canvas-container">
                            <MoleculeCanvas smiles={currentStep.product_smiles} width={canvasWidth} height={canvasHeight} showPlusSeparator={currentStep.product_split_by_plus} />
                        </div>
                    ), 'size-large')}
                </div>
            </div>

            <div className="reaction-info-section">
                <div className="reaction-name-box">
                    {renderQuizContent('name', <p className="reaction-type">{currentStep.reaction_type}</p>, 'size-auto')}
                </div>
                <div className="notes-section">
                    {renderQuizContent('notes', <p>{currentStep.notes}</p>, 'size-auto')}
                </div>
            </div>

            <div className="player-controls">
                <button onClick={handlePrev} disabled={currentStepIndex === 0} className="control-btn">
                    <ChevronLeft /> Previous
                </button>

                <div className="citation-info">
                    <span>{synthesis.meta.author}, {synthesis.meta.year}</span>
                    <span className="journal-name">{synthesis.meta.journal}</span>
                </div>

                <button onClick={handleNext} disabled={currentStepIndex === totalSteps - 1} className="control-btn">
                    Next <ChevronRight />
                </button>
            </div>
        </div>
    );
};

export default SequencePlayer;
