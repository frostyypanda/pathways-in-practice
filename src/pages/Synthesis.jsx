import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataManager } from '../utils/DataManager';
import SequencePlayer from '../components/SequencePlayer';
import { ArrowLeft } from 'lucide-react';

const Synthesis = () => {
    const { id } = useParams();
    const [synthesis, setSynthesis] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSynthesis = async () => {
            // Find the path from the index first (or we could just construct it if we knew the structure perfectly, 
            // but using index is safer if we want to support arbitrary paths)
            // For V1, we'll fetch the index to find the path.
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

    return (
        <div className="synthesis-page">
            <header className="synthesis-header">
                <Link to="/" className="back-link"><ArrowLeft /> Back to Library</Link>
                <h1>{synthesis.meta.molecule_name}</h1>
                <div className="meta-info">
                    <span>{synthesis.meta.author}, {synthesis.meta.year}</span>
                    <span>{synthesis.meta.journal}</span>
                </div>
            </header>

            <SequencePlayer synthesis={synthesis} />
        </div>
    );
};

export default Synthesis;
