import React, { useEffect, useRef } from 'react';

const MoleculeCanvas = React.memo(({ smiles, width = 300, height = 200, theme = 'light' }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!smiles || !canvasRef.current || !window.SmilesDrawer) return;

        try {
            const drawer = new window.SmilesDrawer.Drawer({
                width: width,
                height: height,
                compactDrawing: false,
            });

            window.SmilesDrawer.parse(smiles, (tree) => {
                drawer.draw(tree, canvasRef.current, theme, false);
            }, (err) => {
                console.error('Error parsing SMILES:', err);
            });
        } catch (e) {
            console.error("Failed to initialize SmilesDrawer:", e);
        }
    }, [smiles, width, height, theme]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="molecule-canvas"
        />
    );
});

export default MoleculeCanvas;
