import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "./RouteLine.css";

/**
 * RouteLine - draws a polyline between waypoints using OSRM for road-snapped routes.
 * Falls back to a straight polyline if the OSRM request fails or is aborted.
 */
function RouteLine({ route, color = "#3b82f6" }) {
  const map = useMap();
  const polylineRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (!map || !route || route.length < 2) return;

    // Normalize route points to [lat, lng] arrays
    const points = route.map((point) => {
      if (Array.isArray(point)) {
        return [point[0], point[1]];
      }
      return [point.lat, point.lon ?? point.lng];
    });

    // Cleanup previous polyline
    if (polylineRef.current) {
      try {
        map.removeLayer(polylineRef.current);
      } catch {
        // ignore
      }
      polylineRef.current = null;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Draw a simple straight-line polyline as a fallback / placeholder
    const drawFallback = () => {
      if (!map.getContainer()) return;
      const line = L.polyline(points, {
        color,
        weight: 5,
        opacity: 0.8,
        dashArray: "10, 10", // dashed to indicate straight line
      }).addTo(map);
      polylineRef.current = line;
    };

    // Try to fetch a road-snapped route from OSRM
    const coordsStr = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    fetch(url, { signal: abortControllerRef.current.signal })
      .then((res) => {
        if (!res.ok) throw new Error("OSRM request failed");
        return res.json();
      })
      .then((data) => {
        if (!map.getContainer()) return; // component unmounted
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map(
            ([lng, lat]) => [lat, lng]
          );
          const line = L.polyline(coords, {
            color,
            weight: 5,
            opacity: 0.8,
          }).addTo(map);
          polylineRef.current = line;
        } else {
          drawFallback();
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return; // ignore aborted requests
        console.warn(
          "OSRM route fetch failed, using fallback polyline:",
          err.message
        );
        drawFallback();
      });

    // Cleanup on unmount or route change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (polylineRef.current) {
        try {
          if (map.getContainer()) {
            map.removeLayer(polylineRef.current);
          }
        } catch {
          // ignore
        }
        polylineRef.current = null;
      }
    };
  }, [map, route, color]);

  return null;
}

export default RouteLine;
