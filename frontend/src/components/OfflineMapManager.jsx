import { useEffect, useState, useRef } from "react";
import { useMap, TileLayer } from "react-leaflet";
import L from "leaflet";
import { db } from "../services";
import "./OfflineMapManager.css";

// Custom Offline TileLayer
const OfflineTileLayer = ({ url }) => {
  const map = useMap();

  useEffect(() => {
    // Create custom tile layer that checks IndexedDB first
    const OfflineLayer = L.TileLayer.extend({
      createTile: function (coords, done) {
        const tile = document.createElement("img");
        const key = `tile_${coords.z}_${coords.x}_${coords.y}`;

        // Try to load from IndexedDB first
        db.mapTiles
          .get(key)
          .then((record) => {
            if (record && record.blob) {
              // Tile found in cache
              const url = URL.createObjectURL(record.blob);
              tile.src = url;
              tile.onload = () => {
                URL.revokeObjectURL(url);
                done(null, tile);
              };
            } else {
              // Not in cache, fetch from network
              const tileUrl = this.getTileUrl(coords);
              tile.src = tileUrl;
              tile.onload = () => done(null, tile);
              tile.onerror = () => done(new Error("Tile load error"), tile);
            }
          })
          .catch(() => {
            // Fallback to network on error
            const tileUrl = this.getTileUrl(coords);
            tile.src = tileUrl;
            tile.onload = () => done(null, tile);
            tile.onerror = () => done(new Error("Tile load error"), tile);
          });

        return tile;
      },
    });

    const offlineLayer = new OfflineLayer(url, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });

    offlineLayer.addTo(map);

    return () => {
      map.removeLayer(offlineLayer);
    };
  }, [map, url]);

  return null;
};

// Main OfflineMapManager Component
const OfflineMapManager = () => {
  const map = useMap();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const abortControllerRef = useRef(null);

  // Calculate tile coordinates for a given lat/lng at a zoom level
  const latLngToTile = (lat, lng, zoom) => {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
        ) /
          Math.PI) /
        2) *
        Math.pow(2, zoom)
    );
    return { x, y };
  };

  // Download tiles for current map sector
  const downloadSector = async () => {
    if (isDownloading) {
      return;
    }

    setIsDownloading(true);
    abortControllerRef.current = new AbortController();

    try {
      // Get current map bounds
      const bounds = map.getBounds();
      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();

      const minZoom = 13;
      const maxZoom = 18;
      const tiles = [];

      // Calculate all tiles needed
      for (let z = minZoom; z <= maxZoom; z++) {
        const topLeft = latLngToTile(northEast.lat, southWest.lng, z);
        const bottomRight = latLngToTile(southWest.lat, northEast.lng, z);

        const minX = Math.min(topLeft.x, bottomRight.x);
        const maxX = Math.max(topLeft.x, bottomRight.x);
        const minY = Math.min(topLeft.y, bottomRight.y);
        const maxY = Math.max(topLeft.y, bottomRight.y);

        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            tiles.push({ z, x, y });
          }
        }
      }

      setProgress({ current: 0, total: tiles.length });

      let downloaded = 0;
      let cached = 0;
      let failed = 0;

      // Download tiles in batches to avoid overwhelming the browser
      const batchSize = 10;
      for (let i = 0; i < tiles.length; i += batchSize) {
        if (abortControllerRef.current.signal.aborted) {
          break;
        }

        const batch = tiles.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async ({ z, x, y }) => {
            try {
              const key = `tile_${z}_${x}_${y}`;

              // Check if tile already exists
              const existing = await db.mapTiles.get(key);
              if (existing) {
                cached++;
                return;
              }

              // Fetch tile from OpenStreetMap
              const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
              const response = await fetch(url, {
                signal: abortControllerRef.current.signal,
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }

              const blob = await response.blob();
              await db.mapTiles.add({ key, blob });
              downloaded++;

              // Small delay to be respectful to OSM servers
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
              if (error.name !== "AbortError") {
                failed++;
                console.error(
                  `Failed to download tile ${z}/${x}/${y}:`,
                  error.message
                );
              }
            }
          })
        );

        setProgress({ current: i + batch.length, total: tiles.length });
      }

      alert(
        `Sector download complete!\nDownloaded: ${downloaded}\nCached: ${cached}\nFailed: ${failed}`
      );
    } catch (error) {
      console.error("Error downloading tiles:", error);
      alert("Error downloading tiles. Check console for details.");
    } finally {
      setIsDownloading(false);
      abortControllerRef.current = null;
      setProgress({ current: 0, total: 0 });
    }
  };

  const cancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="offline-map-manager">
      <button
        onClick={downloadSector}
        disabled={isDownloading}
        className="download-btn"
      >
        {isDownloading ? "Downloading..." : "Download Sector"}
      </button>

      {isDownloading && (
        <div className="download-progress">
          <button onClick={cancelDownload} className="cancel-btn">
            Cancel
          </button>
          <div className="progress-text">
            {progress.current} / {progress.total} tiles
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export { OfflineMapManager, OfflineTileLayer };
export default OfflineMapManager;
