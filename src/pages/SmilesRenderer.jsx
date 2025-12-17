import React, { useState } from 'react';
import MoleculeCanvas from '../components/MoleculeCanvas';

function SmilesRenderer() {
  const [smilesInputs, setSmilesInputs] = useState(['', '', '', '']);

  const updateSmiles = (index, value) => {
    const newInputs = [...smilesInputs];
    newInputs[index] = value;
    setSmilesInputs(newInputs);
  };

  const addMore = () => {
    setSmilesInputs([...smilesInputs, '', '', '', '']);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>SMILES Renderer</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {smilesInputs.map((smiles, index) => (
          <div key={index} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '15px' }}>
            <textarea
              value={smiles}
              onChange={(e) => updateSmiles(index, e.target.value)}
              placeholder="Paste SMILES here..."
              style={{ width: '100%', height: '60px', marginBottom: '10px', fontFamily: 'monospace', fontSize: '14px' }}
            />
            {smiles && (
              <div style={{ background: '#fff', borderRadius: '4px', display: 'flex', justifyContent: 'center' }}>
                <MoleculeCanvas key={smiles} smiles={smiles} width={300} height={200} />
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={addMore} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
        + Add More
      </button>
    </div>
  );
}

export default SmilesRenderer;
