import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataManager } from '../utils/DataManager';
import { Search } from 'lucide-react';

const Home = () => {
    const [syntheses, setSyntheses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [minSteps, setMinSteps] = useState('');
    const [maxSteps, setMaxSteps] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const data = await DataManager.getAllSyntheses();
            setSyntheses(data);
        };
        loadData();
    }, []);

    const filteredSyntheses = syntheses.filter(s => {
        const matchesSearch = s.molecule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.author.toLowerCase().includes(searchTerm.toLowerCase());

        const steps = s.step_count || 1; // Default to 1 if not calculated yet
        const matchesMinString = minSteps === '' || steps >= parseInt(minSteps);
        const matchesMaxString = maxSteps === '' || steps <= parseInt(maxSteps);

        return matchesSearch && matchesMinString && matchesMaxString;
    });

    return (
        <div className="home-page">
            <header className="app-header">
                <h1>OpenSynth</h1>
                <p>Community-driven chemical synthesis library</p>
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
