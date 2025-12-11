import React from 'react';

const DesktopView = () => {
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa',
            color: '#333',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Desktop View Coming Soon</h1>
            <p style={{ fontSize: '1.2rem', color: '#666' }}>
                This application is currently optimized for mobile portrait mode.
            </p>
        </div>
    );
};

export default DesktopView;
