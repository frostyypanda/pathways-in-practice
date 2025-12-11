import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

const QuizControls = ({ settings, onToggle }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const options = [
        { id: 'reactant', label: 'Reactant' },
        { id: 'name', label: 'Reaction Name' },
        { id: 'conditions', label: 'Conditions' },
        { id: 'product', label: 'Product' },
        { id: 'notes', label: 'Notes' },
    ];

    return (
        <div className="quiz-controls" style={{ transition: 'all 0.3s ease' }}>
            <div
                className="quiz-header"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isExpanded ? '1rem' : '0' }}
            >
                <h3>Quiz Mode</h3>
                {isExpanded ? <EyeOff size={20} /> : <Eye size={20} />}
            </div>

            {isExpanded && (
                <>
                    <div className="quiz-toggles">
                        {options.map(option => (
                            <button
                                key={option.id}
                                className={`quiz-toggle-btn ${settings[option.id] ? 'active' : ''}`}
                                onClick={() => onToggle(option.id)}
                                title={settings[option.id] ? `Show ${option.label}` : `Hide ${option.label}`}
                            >
                                {settings[option.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                    <p className="quiz-hint">Toggle items to hide them. Click hidden boxes to reveal.</p>
                </>
            )}
        </div>
    );
};

export default QuizControls;
