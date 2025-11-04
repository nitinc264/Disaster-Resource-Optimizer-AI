// # **[Part 3] Draws the optimized route**
// Aegis AI/frontend/src/components/RouteLine.jsx

import React from 'react';
import { Polyline } from 'react-leaflet';

function RouteLine({ route }) {
    // `route` is an array of [lat, lon] coordinates
    
    const routeOptions = {
        color: 'blue',
        weight: 5,
        opacity: 0.7,
        dashArray: '10, 10'
    };

    return (
        <Polyline 
            positions={route}
            pathOptions={routeOptions}
        />
    );
}

export default RouteLine;
