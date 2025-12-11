import { useState, useEffect } from 'react';

/**
 * Custom hook to detect the current device state based on viewport dimensions and orientation.
 * Returns one of: 'DESKTOP' | 'MOBILE_LANDSCAPE' | 'MOBILE_PORTRAIT'
 */
const useDeviceDetection = () => {
    const [deviceState, setDeviceState] = useState('MOBILE_PORTRAIT');

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const orientation = width > height ? 'landscape' : 'portrait';

            // Mobile Portrait: Width <= 768px (standard tablet/phone width) AND portrait orientation
            if (width <= 768 && orientation === 'portrait') {
                setDeviceState('MOBILE_PORTRAIT');
                return;
            }

            // Mobile Landscape: Height <= 600px (standard phone logical height in landscape) AND landscape orientation
            // We use 600px as a safe upper bound for phone landscape heights (iPhone 14 Pro Max is ~430px)
            if (height <= 600 && orientation === 'landscape') {
                setDeviceState('MOBILE_LANDSCAPE');
                return;
            }

            // Default to Desktop for everything else (large tablets, laptops, desktops)
            setDeviceState('DESKTOP');
        };

        // Initial check
        handleResize();

        // Add event listener
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return deviceState;
};

export default useDeviceDetection;
