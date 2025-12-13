import React, { useEffect, useRef } from 'react';

// Single molecule canvas component
// Renders at 2x resolution for crisp display on all screens
const SingleMoleculeCanvas = React.memo(({ smiles, width = 300, height = 200, theme = 'light' }) => {
    const canvasRef = useRef(null);
    const [error, setError] = React.useState(null);

    // Use 2x scale for high-resolution rendering
    const scale = 2;
    const renderWidth = width * scale;
    const renderHeight = height * scale;

    useEffect(() => {
        if (!smiles || !canvasRef.current || !window.SmilesDrawer) return;

        // Reset error state on new SMILES
        setError(null);

        try {
            const drawer = new window.SmilesDrawer.Drawer({
                width: renderWidth,
                height: renderHeight,
                compactDrawing: false,
            });

            window.SmilesDrawer.parse(smiles, (tree) => {
                drawer.draw(tree, canvasRef.current, theme, false);
            }, (err) => {
                console.error(`Error parsing SMILES "${smiles}":`, err);
                setError(err.message || "Parse Error");
            });
        } catch (e) {
            console.error(`Failed to initialize SmilesDrawer for SMILES "${smiles}":`, e);
            setError(e.message || "Init Error");
        }
    }, [smiles, renderWidth, renderHeight, theme]);

    if (error) {
        return (
            <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffe6e6', border: '1px solid red', padding: '10px', textAlign: 'center', color: '#cc0000', fontSize: '12px' }}>
                Error: {error}
                <br />
                <span style={{ fontSize: '10px', color: '#666' }}>({smiles})</span>
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            width={renderWidth}
            height={renderHeight}
            style={{ width: `${width}px`, height: `${height}px` }}
            className="molecule-canvas"
        />
    );
});

// Main component that handles multiple molecules with optional "+" separator
const MoleculeCanvas = React.memo(({ smiles, width = 300, height = 200, theme = 'light', showPlusSeparator = false }) => {
    if (!smiles) return null;

    // Check if SMILES contains multiple molecules (dot notation)
    const molecules = smiles.split('.');

    if (molecules.length === 1 || !showPlusSeparator) {
        // Single molecule or no separator needed - render as before
        return <SingleMoleculeCanvas smiles={smiles} width={width} height={height} theme={theme} />;
    }

    // Multiple molecules with "+" separator
    const singleWidth = Math.floor(width / molecules.length) - 10;

    return (
        <div className="molecule-canvas-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            {molecules.map((mol, index) => (
                <React.Fragment key={index}>
                    <SingleMoleculeCanvas
                        smiles={mol}
                        width={singleWidth}
                        height={height}
                        theme={theme}
                    />
                    {index < molecules.length - 1 && (
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#666' }}>+</span>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
});

export default MoleculeCanvas;
