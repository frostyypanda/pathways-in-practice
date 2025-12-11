import React from 'react';

const MobileLandscapeView = () => {
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a', // Darker background for "warning" feel
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '2rem',
            textAlign: 'center'
        }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>↻</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Please Rotate Your Device</h1>
            <p style={{ fontSize: '1rem', opacity: 0.8 }}>
                This application is designed for use in Portrait mode.
            </p>
        </div>
    );
};

export default MobileLandscapeView;
