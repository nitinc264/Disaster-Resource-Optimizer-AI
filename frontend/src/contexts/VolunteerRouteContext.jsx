import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { getVolunteerRoute } from "../services/apiService";

const VolunteerRouteContext = createContext(null);

export function VolunteerRouteProvider({ children }) {
  const [activeRoute, setActiveRoute] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastKnownLocation, setLastKnownLocation] = useState(null); // Keep last known even if GPS fails
  const [locationError, setLocationError] = useState(null);
  const [isLocationStale, setIsLocationStale] = useState(false); // True if using old location
  const [routeInfo, setRouteInfo] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // Watch volunteer's current location - resilient to temporary failures
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("unsupported");
      return;
    }

    let watchId = null;
    let retryInterval = null;
    let lastUpdateTime = Date.now();

    const startWatching = () => {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          console.log("Location received:", newLocation.lat, newLocation.lng);

          setCurrentLocation(newLocation);
          setLastKnownLocation(newLocation); // Always save last known
          setLocationError(null);
          setIsLocationStale(false);
          lastUpdateTime = Date.now();
        },
        (error) => {
          console.log("Location error:", error.code, error.message);

          if (error.code === 1) {
            // PERMISSION_DENIED
            setLocationError("denied");
            // Don't clear locations - keep last known
          } else {
            // Timeout or unavailable - mark as stale but keep last location
            const timeSinceUpdate = Date.now() - lastUpdateTime;
            if (timeSinceUpdate > 30000) {
              // 30 seconds without update
              setIsLocationStale(true);
            }
            // Don't set error - just keep trying
            // Don't clear currentLocation or lastKnownLocation
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000, // Accept position up to 30 seconds old
          timeout: 10000, // 10 second timeout
        }
      );
    };

    // Start watching
    startWatching();

    // Backup: periodically try getCurrentPosition in case watchPosition stops working
    retryInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(newLocation);
          setLastKnownLocation(newLocation);
          setLocationError(null);
          setIsLocationStale(false);
          lastUpdateTime = Date.now();
        },
        () => {
          // Silent fail - watchPosition is still trying
        },
        {
          enableHighAccuracy: false,
          maximumAge: 60000,
          timeout: 5000,
        }
      );
    }, 15000); // Every 15 seconds

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (retryInterval) clearInterval(retryInterval);
    };
  }, []);

  // Start route to a task location using centralized backend routing service
  const startRoute = useCallback(
    async (task) => {
      if (!task || !task.lat || !task.lon) {
        console.warn("Cannot start route: task has no coordinates");
        return false;
      }

      // Use current location, or fall back to last known location
      const locationToUse = currentLocation || lastKnownLocation;

      if (!locationToUse) {
        console.warn("Cannot start route: no location available");
        return false;
      }

      setIsLoadingRoute(true);
      setActiveTask(task);

      try {
        // Use centralized backend routing service
        const origin = { lat: locationToUse.lat, lon: locationToUse.lng };
        const destination = { lat: task.lat, lon: task.lon };

        const routeData = await getVolunteerRoute(origin, destination);

        // Set the route geometry for map display
        setActiveRoute(routeData.geometry);
        setRouteInfo({
          distance: routeData.distance,
          duration: routeData.duration,
          isFallback: routeData.isFallback || false,
        });

        return true;
      } catch (error) {
        console.error("Error fetching route from backend:", error);

        // Fallback to simple two-point straight line route
        // Since RouteLine no longer calls OSRM, this will show as dashed
        const fallbackRoute = [
          { lat: locationToUse.lat, lon: locationToUse.lng },
          { lat: task.lat, lon: task.lon },
        ];
        setActiveRoute(fallbackRoute);
        setRouteInfo({
          distance: null,
          duration: null,
          isFallback: true, // Mark as fallback so Map can pass dashed prop
        });

        return true;
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [currentLocation, lastKnownLocation]
  );

  // Cancel active route
  const cancelRoute = useCallback(() => {
    setActiveRoute(null);
    setActiveTask(null);
    setRouteInfo(null);
  }, []);

  const value = {
    activeRoute,
    activeTask,
    currentLocation: currentLocation || lastKnownLocation, // Always provide a location if we have one
    lastKnownLocation,
    locationError,
    isLocationStale,
    routeInfo,
    isLoadingRoute,
    startRoute,
    cancelRoute,
    hasActiveRoute: !!activeRoute,
  };

  return (
    <VolunteerRouteContext.Provider value={value}>
      {children}
    </VolunteerRouteContext.Provider>
  );
}

export function useVolunteerRoute() {
  const context = useContext(VolunteerRouteContext);
  if (!context) {
    throw new Error(
      "useVolunteerRoute must be used within a VolunteerRouteProvider"
    );
  }
  return context;
}
