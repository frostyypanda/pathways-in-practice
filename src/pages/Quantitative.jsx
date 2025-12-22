import React from 'react';
import { Link } from 'react-router-dom';

function Quantitative() {
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/" style={{ color: '#4a9eff', textDecoration: 'none' }}>&larr; Back to Home</Link>
      </div>
      <h1>Quantitative Analysis</h1>
      <p style={{ color: '#666' }}>This page is under construction. Functionality coming soon.</p>
    </div>
  );
}

export default Quantitative;
