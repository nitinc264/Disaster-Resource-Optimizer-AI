// # **[Part 3] Your main page (at '/dashboard')**
// Aegis AI/frontend/src/pages/DashboardPage.jsx

import React, { useState, useEffect } from 'react';
import Map from '../components/Map'; // Your main map component
import { optimizeRoute } from '../services/api'; // Your API service

// --- MOCK DATA ---
// In a real app, this would come from your Supabase/Firebase subscription
// This simulates data from Part 1 (SMS Bot) and Part 2 (PWA)
const MOCK_NEEDS_FROM_DB = [
    { id: 1, lat: 18.5204, lon: 73.8567, description: "Need water at Shaniwar Wada", status: 'Unverified' },
    { id: 2, lat: 18.5167, lon: 73.8562, description: "Requesting medical aid", status: 'Verified' },
    { id: 3, lat: 18.5236, lon: 73.8495, description: "Food shortage for 5 people", status: 'Verified' },
    { id: 4, lat: 18.5196, lon: 73.8554, description: "Trapped in building", status: 'Unverified' },
];

// This is your command center / truck starting point
const DEPOT_LOCATION = { lat: 18.5210, lon: 73.8540 };
// ---------------

function DashboardPage() {
    const [needs, setNeeds] = useState([]);
    const [selectedNeedIds, setSelectedNeedIds] = useState(new Set());
    const [optimizedRoute, setOptimizedRoute] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // This useEffect simulates fetching/subscribing to real-time database changes
    useEffect(() => {
        // In a real app:
        // supabase.from('needs').on('*', (payload) => {
        //   setNeeds(prevNeeds => ... update logic ...);
        // }).subscribe();
        
        setNeeds(MOCK_NEEDS_FROM_DB);
        console.log("Dashboard loaded, needs populated.");
    }, []);

    // Handles clicking on a map pin
    const handlePinClick = (needId) => {
        const clickedNeed = needs.find(n => n.id === needId);

        // Only allow selecting 'Verified' needs for optimization
        if (clickedNeed && clickedNeed.status !== 'Verified') {
            alert("This need is not verified yet. A volunteer must verify it first.");
            return;
        }

        // Add or remove the ID from the Set of selected needs
        setSelectedNeedIds(prevSelectedIds => {
            const newIds = new Set(prevSelectedIds);
            if (newIds.has(needId)) {
                newIds.delete(needId);
            } else {
                newIds.add(needId);
            }
            return newIds;
        });
    };

    // This function calls your backend API
    const handleOptimizeRoute = async () => {
        setIsLoading(true);
        setError(null);
        setOptimizedRoute([]); // Clear previous route

        // 1. Get the full location objects for the selected IDs
        const verifiedStops = needs
            .filter(need => selectedNeedIds.has(need.id))
            .map(need => ({ lat: need.lat, lon: need.lon }));

        if (verifiedStops.length === 0) {
            setError("Please select at least one verified stop to optimize.");
            setIsLoading(false);
            return;
        }

        // 2. Prepare the request payload
        const requestPayload = {
            depot: DEPOT_LOCATION,
            stops: verifiedStops
        };

        // 3. Call the API
        try {
            const response = await optimizeRoute(requestPayload);
            // The response.optimized_route is a list of {lat, lon} objects
            // Convert it to [lat, lon] arrays for the Polyline component
            const routeCoords = response.optimized_route.map(loc => [loc.lat, loc.lon]);
            setOptimizedRoute(routeCoords);
        } catch (err) {
            console.error("Optimization failed:", err);
            setError("Failed to calculate route. See console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            <div style={{ width: '300px', padding: '10px', overflowY: 'auto', borderRight: '1px solid #ccc' }}>
                <h2>Aegis AI Dashboard</h2>
                <button 
                    onClick={handleOptimizeRoute} 
                    disabled={isLoading || selectedNeedIds.size === 0}
                >
                    {isLoading ? 'Calculating...' : `Optimize ${selectedNeedIds.size} Stops`}
                </button>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                
                <hr />
                <h3>All Needs:</h3>
                <ul>
                    {needs.map(need => (
                        <li key={need.id} style={{ color: need.status === 'Verified' ? 'green' : 'gray' }}>
                            {need.description} ({need.status})
                        </li>
                    ))}
                </ul>
            </div>
            
            <div style={{ flex: 1 }}>
                <Map
                    depot={DEPOT_LOCATION}
                    needs={needs}
                    selectedNeedIds={selectedNeedIds}
                    onPinClick={handlePinClick}
                    optimizedRoute={optimizedRoute}
                />
            </div>
        </div>
    );
}

export default DashboardPage;