import { useState, useRef } from "react";
import { useMap } from "react-leaflet";
import { useTranslation } from "react-i18next";
import { db } from "../services";
import "./OfflineMapManager.css";

// Tile servers to try (some are more CORS-friendly)
const TILE_SERVERS = [
  "https://a.tile.openstreetmap.org",
  "https://b.tile.openstreetmap.org",
  "https://c.tile.openstreetmap.org",
];

// Main OfflineMapManager Component
const OfflineMapManager = () => {
  const map = useMap();
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    status: "",
  });
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

  // Get a random tile server to distribute load
  const getRandomServer = () => {
    return TILE_SERVERS[Math.floor(Math.random() * TILE_SERVERS.length)];
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
      const currentZoom = map.getZoom();

      // Download tiles for current zoom +/- 2 levels
      const minZoom = Math.max(10, currentZoom - 2);
      const maxZoom = Math.min(18, currentZoom + 2);
      const tiles = [];

      setProgress({ current: 0, total: 0, status: "Calculating tiles..." });

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

      // Limit total tiles to prevent excessive downloads
      const maxTiles = 500;
      if (tiles.length > maxTiles) {
        alert(
          `Too many tiles (${tiles.length}). Please zoom in to download a smaller area (max ${maxTiles} tiles).`
        );
        setIsDownloading(false);
        return;
      }

      setProgress({
        current: 0,
        total: tiles.length,
        status: "Downloading...",
      });

      let downloaded = 0;
      let cached = 0;
      let failed = 0;

      // Download tiles in batches
      const batchSize = 6;
      for (let i = 0; i < tiles.length; i += batchSize) {
        if (abortControllerRef.current.signal.aborted) {
          break;
        }

        const batch = tiles.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async ({ z, x, y }) => {
            try {
              const key = `tile_${z}_${x}_${y}`;

              // Check if tile already exists in cache
              const existing = await db.mapTiles.get(key);
              if (existing) {
                cached++;
                return;
              }

              // Fetch tile from OpenStreetMap with random server
              const server = getRandomServer();
              const url = `${server}/${z}/${x}/${y}.png`;

              const response = await fetch(url, {
                signal: abortControllerRef.current.signal,
                mode: "cors",
                headers: {
                  Accept: "image/png,image/*",
                },
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }

              const blob = await response.blob();

              // Store tile in IndexedDB using put (upsert)
              await db.mapTiles.put({ key, blob, timestamp: Date.now() });
              downloaded++;

              // Respectful delay to OSM servers (they request 1 tile/sec for heavy use)
              await new Promise((resolve) => setTimeout(resolve, 150));
            } catch (error) {
              if (error.name !== "AbortError") {
                failed++;
                console.warn(`Tile ${z}/${x}/${y} failed:`, error.message);
              }
            }
          })
        );

        setProgress({
          current: Math.min(i + batch.length, tiles.length),
          total: tiles.length,
          status: `Downloaded ${downloaded}, Cached ${cached}, Failed ${failed}`,
        });
      }

      const message = abortControllerRef.current.signal.aborted
        ? t("map.downloadCancelled")
        : t("map.downloadComplete");

      alert(message);
    } catch (error) {
      console.error("Error downloading tiles:", error);
      alert("Error downloading tiles: " + error.message);
    } finally {
      setIsDownloading(false);
      abortControllerRef.current = null;
      setProgress({ current: 0, total: 0, status: "" });
    }
  };

  const cancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Clear cached tiles
  const clearCache = async () => {
    if (confirm(t("map.clearCacheConfirm"))) {
      try {
        await db.mapTiles.clear();
        alert(t("map.cacheCleared"));
      } catch (error) {
        alert("Error clearing cache: " + error.message);
      }
    }
  };

  return (
    <div className="offline-map-manager">
      {!isDownloading ? (
        <div className="manager-buttons">
          <button onClick={downloadSector} className="download-btn">
            {t("map.downloadSector")}
          </button>
          <button onClick={clearCache} className="clear-btn">
            {t("map.clearCache")}
          </button>
        </div>
      ) : (
        <div className="download-progress">
          <div className="progress-header">
            <span>{t("map.downloading")}...</span>
            <button onClick={cancelDownload} className="cancel-btn">
              ✕
            </button>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${
                  progress.total > 0
                    ? (progress.current / progress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="progress-text">
            {progress.current} / {progress.total} tiles
          </div>
          {progress.status && (
            <div className="progress-status">{progress.status}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineMapManager;
