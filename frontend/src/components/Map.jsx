// # React (Vite) or Vue project  for Frontend

//  # **[Part 3] Your core map component**

// Aegis AI/frontend/src/components/Map.jsx

import React from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import L from 'leaflet'; // Import Leaflet library

import MapPin from './MapPin';
import RouteLine from './RouteLine';

// --- FIX for default Leaflet icon ---
// This prevents the default marker icon from being broken
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
// ---------------------------------

// A custom icon for the depot (truck)
const depotIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/64/3048/3048981.png', // A truck icon
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});


function Map({ depot, needs, selectedNeedIds, onPinClick, optimizedRoute }) {
    const centerPosition = [depot.lat, depot.lon];

    return (
        <MapContainer center={centerPosition} zoom={14} style={{ height: '100%', width: '100%' }}>
            {/* Base map tiles */}
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* 1. Render the Depot (Truck) Marker */}
            <Marker position={[depot.lat, depot.lon]} icon={depotIcon} />

            {/* 2. Render all the 'Need' Pins */}
            {needs.map(need => (
                <MapPin 
                    key={need.id}
                    need={need}
                    isSelected={selectedNeedIds.has(need.id)}
                    onClick={onPinClick}
                />
            ))}
            
            {/* 3. Render the optimized route line if it exists */}
            {optimizedRoute.length > 0 && (
                <RouteLine route={optimizedRoute} />
            )}
            
        </MapContainer>
    );
}

export default Map;