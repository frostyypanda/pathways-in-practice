import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataManager } from '../utils/DataManager';
import { Search } from 'lucide-react';

const Home = () => {
    const [syntheses, setSyntheses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const data = await DataManager.getAllSyntheses();
            setSyntheses(data);
        };
        loadData();
    }, []);

    const filteredSyntheses = syntheses.filter(s =>
        s.molecule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.author.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

            <div className="synthesis-grid">
                {filteredSyntheses.map(synth => (
                    <Link to={`/synthesis/${synth.id}`} key={synth.id} className="synthesis-card">
                        <h2>{synth.molecule_name}</h2>
                        <p className="author">{synth.author} ({synth.year})</p>
                        <span className="tag">{synth.class}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default Home;
