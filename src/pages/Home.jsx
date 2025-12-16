import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DataManager } from '../utils/DataManager';
import { Search } from 'lucide-react';

// Shuffle array using Fisher-Yates algorithm with seed for consistency per session
const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

const Home = () => {
    const [syntheses, setSyntheses] = useState([]);
    const [randomSample, setRandomSample] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [minSteps, setMinSteps] = useState('');
    const [maxSteps, setMaxSteps] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const data = await DataManager.getAllSyntheses();
            setSyntheses(data);
            // Create random sample of 50 for initial display
            setRandomSample(shuffleArray(data).slice(0, 50));
        };
        loadData();
    }, []);

    // Check if any filters are active
    const hasActiveFilters = searchTerm !== '' || minSteps !== '' || maxSteps !== '';

    const filteredSyntheses = useMemo(() => {
        // Use full list when filtering, random sample when not
        const sourceList = hasActiveFilters ? syntheses : randomSample;

        return sourceList.filter(s => {
            const matchesSearch = s.molecule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.author.toLowerCase().includes(searchTerm.toLowerCase());

            const steps = s.step_count || 1;
            const matchesMinString = minSteps === '' || steps >= parseInt(minSteps);
            const matchesMaxString = maxSteps === '' || steps <= parseInt(maxSteps);

            return matchesSearch && matchesMinString && matchesMaxString;
        });
    }, [syntheses, randomSample, searchTerm, minSteps, maxSteps, hasActiveFilters]);

    return (
        <div className="home-page">
            <header className="app-header">
                <img src="/logo-transparent.png" alt="Pathways Practice Logo" className="app-logo" />
                <div className="header-text">
                    <h1>Pathways Practice</h1>
                    <p>Community-driven chemical synthesis library</p>
                </div>
                <div className="total-count">{syntheses.length} syntheses</div>
            </header>

            <div className="search-bar">
                <Search size={20} />
                <input
                    type="text"
                    placeholder="Search molecules, authors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="filter-bar">
                <div className="step-filter">
                    <label>Min Steps:</label>
                    <input
                        type="number"
                        min="1"
                        value={minSteps}
                        onChange={(e) => setMinSteps(e.target.value)}
                        placeholder="Any"
                    />
                </div>
                <div className="step-filter">
                    <label>Max Steps:</label>
                    <input
                        type="number"
                        min="1"
                        value={maxSteps}
                        onChange={(e) => setMaxSteps(e.target.value)}
                        placeholder="Any"
                    />
                </div>
            </div>

            <div className="results-info">
                {hasActiveFilters
                    ? `${filteredSyntheses.length} results`
                    : `Showing 50 random syntheses`}
            </div>

            <div className="synthesis-grid">
                {filteredSyntheses.map(synth => (
                    <Link to={`/synthesis/${synth.id}`} key={synth.id} className="synthesis-card">
                        <h2>{synth.molecule_name}</h2>
                        <p className="author">{synth.author} ({synth.year})</p>
                        <div className="card-meta">
                            <span className="tag">{synth.class}</span>
                            <span className="step-badge">{synth.step_count || 1} Steps</span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default Home;
