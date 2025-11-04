// # **[Part 3] Component for a single map pin**
// Aegis AI/frontend/src/components/MapPin.jsx

import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Custom icons for different pin states
const createCustomIcon = (color, isSelected) => {
  const markerHtml = `
    <span style="
      background-color: ${color};
      width: 2rem;
      height: 2rem;
      display: block;
      left: -1rem;
      top: -1rem;
      position: relative;
      border-radius: 2rem 2rem 0;
      transform: rotate(45deg);
      border: 2px solid ${isSelected ? '#000' : '#fff'};
      box-shadow: 0 0 5px rgba(0,0,0,0.5);
    "></span>`;

  return new L.DivIcon({
    className: "my-custom-pin",
    iconAnchor: [0, 16],
    popupAnchor: [0, -20],
    html: markerHtml
  });
};

// Define icons for each state
const verifiedIcon = createCustomIcon('green', false);
const unverifiedIcon = createCustomIcon('gray', false);
const selectedIcon = createCustomIcon('lime', true); // Brighter green and selected

function MapPin({ need, isSelected, onClick }) {
    
    // Determine which icon to use
    let icon;
    if (isSelected) {
        icon = selectedIcon;
    } else if (need.status === 'Verified') {
        icon = verifiedIcon;
    } else {
        icon = unverifiedIcon;
    }

    return (
        <Marker 
            position={[need.lat, need.lon]} 
            icon={icon}
            eventHandlers={{
                click: () => {
                    onClick(need.id); // Pass the ID up to the parent
                },
            }}
        >
            <Popup>
                <b>Status: {need.status}</b>
                <p>{need.description}</p>
                {!isSelected && need.status === 'Verified' && (
                    <small>Click pin again to select for routing.</small>
                )}
                {isSelected && (
                    <small>Selected! Click again to de-select.</small>
                )}
            </Popup>
        </Marker>
    );
}

export default MapPin;