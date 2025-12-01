import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import LZString from "lz-string";
import { v4 as uuidv4 } from "uuid";
import {
  Radio,
  Camera,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Image,
} from "lucide-react";
import { db } from "../services";
import "./RelayReceiver.css";

/**
 * RelayReceiver Component
 * Scans QR codes to receive compressed disaster report data
 * and stores it locally for offline sync
 */
const RelayReceiver = ({ onSuccess, onClose }) => {
  const [scanning, setScanning] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [receivedReport, setReceivedReport] = useState(null);
  const [error, setError] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [chunkProgress, setChunkProgress] = useState(null); // { received: [], total: number }
  const html5QrCodeRef = useRef(null);
  const qrCodeRegionRef = useRef(null);
  const chunksRef = useRef({}); // Store received chunks

  // Trigger haptic feedback on success (if supported)
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      // Vibrate pattern: [vibrate, pause, vibrate]
      navigator.vibrate([200, 100, 200]);
    }
  };

  // Handle successful QR code scan
  const handleScan = useCallback(
    async (decodedText) => {
      if (!scanning) return;

      try {
        let compressedData = decodedText;

        // Check if this is a chunked QR code
        if (decodedText.startsWith("RELAY_CHUNK|")) {
          const parts = decodedText.split("|");
          if (parts.length !== 4) {
            throw new Error("Invalid chunk format");
          }

          const chunkIndex = parseInt(parts[1], 10);
          const totalParts = parseInt(parts[2], 10);
          const chunkData = parts[3];

          // Store chunk
          chunksRef.current[chunkIndex] = chunkData;

          // Update progress
          const receivedChunks = Object.keys(chunksRef.current).map(Number);
          setChunkProgress({ received: receivedChunks, total: totalParts });

          // Trigger haptic for chunk received
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          // Check if all chunks received
          if (receivedChunks.length < totalParts) {
            // Still waiting for more chunks
            return;
          }

          // Reassemble all chunks in order
          let fullData = "";
          for (let i = 0; i < totalParts; i++) {
            if (!chunksRef.current[i]) {
              throw new Error(`Missing chunk ${i + 1} of ${totalParts}`);
            }
            fullData += chunksRef.current[i];
          }
          compressedData = fullData;

          // Clear chunks
          chunksRef.current = {};
        }

        setScanning(false);

        // Decompress using LZ-String
        const decompressed = LZString.decompressFromBase64(compressedData);

        if (!decompressed) {
          throw new Error("Failed to decompress data - invalid QR code format");
        }

        // Parse JSON
        const reportData = JSON.parse(decompressed);

        // Generate a unique ID for this relayed report
        const relayId = uuidv4();

        // Prepare report with relay metadata
        const relayedReport = {
          ...reportData,
          relayId,
          source: "RELAY",
          synced: 0, // Use 0 instead of false for Dexie indexing
          relayedAt: Date.now(),
          originalReportId: reportData.reportId,
          timestamp: Date.now(),
          hasImage: reportData.hasImage ? 1 : 0,
        };

        // If report has image data, convert base64 back to blob for storage
        if (reportData.imageBase64) {
          try {
            const byteCharacters = atob(reportData.imageBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            relayedReport.imageBlob = new Blob([byteArray], {
              type: "image/jpeg",
            });
          } catch (imgErr) {
            console.warn("Failed to decode image:", imgErr);
          }
          // Remove base64 from stored report to save space
          delete relayedReport.imageBase64;
        }

        // Save to Dexie
        await db.relayReports.add(relayedReport);

        // Trigger haptic feedback
        triggerHaptic();

        // Show success state
        setReceivedReport(relayedReport);
        setShowSuccess(true);
        setChunkProgress(null);

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(relayedReport);
        }

        // Auto-close after 3 seconds
        setTimeout(() => {
          if (onClose) {
            onClose();
          }
        }, 3000);
      } catch (err) {
        console.error("Error processing QR code:", err);
        setError(err.message || "Failed to process QR code");
        setScanning(true); // Resume scanning on error
      }
    },
    [scanning, onSuccess, onClose]
  );

  // Initialize and start QR code scanner
  useEffect(() => {
    if (!scanning || cameraError || showSuccess) return;

    const qrCodeRegionId = "qr-reader-region";
    let html5QrCode = null;
    let isMounted = true;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    // Small delay to ensure DOM element is ready
    const startScanner = async () => {
      // Wait for next tick to ensure DOM is ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!isMounted) return;

      html5QrCode = new Html5Qrcode(qrCodeRegionId);
      html5QrCodeRef.current = html5QrCode;

      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          handleScan,
          () => {} // Silent error handler for when no QR code detected
        );
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to start scanner:", err);
        setCameraError(
          err.toString().includes("NotAllowedError") ||
            err.toString().includes("Permission")
            ? "Camera access denied. Please enable camera permissions."
            : "Failed to access camera. Please check your device settings."
        );
      }
    };

    startScanner();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState();
          // Only stop if scanning or paused (2 or 3)
          if (state === 2 || state === 3) {
            html5QrCodeRef.current
              .stop()
              .then(() => {
                if (html5QrCodeRef.current) {
                  html5QrCodeRef.current.clear();
                }
              })
              .catch(() => {});
          }
        } catch {
          // Ignore cleanup errors
        }
        html5QrCodeRef.current = null;
      }
    };
  }, [scanning, cameraError, showSuccess, handleScan]);

  return (
    <div className="relay-receiver-container">
      <div className="relay-receiver-card">
        {/* Header */}
        <div className="relay-receiver-header">
          <h2 className="relay-receiver-title">
            <span className="relay-receiver-icon">
              <Radio size={24} />
            </span>
            Data Relay - Receive
          </h2>
          {scanning && !cameraError && (
            <p className="relay-receiver-subtitle">
              Point camera at QR code to receive report data
            </p>
          )}
        </div>

        {/* Camera Error */}
        {cameraError && (
          <div className="relay-receiver-error">
            <span className="relay-receiver-error-icon">
              <Camera size={20} />
            </span>
            <p>{cameraError}</p>
            <button
              onClick={() => {
                setCameraError(null);
                setScanning(true);
              }}
              className="relay-receiver-retry-button"
            >
              Retry
            </button>
          </div>
        )}

        {/* Processing Error */}
        {error && (
          <div className="relay-receiver-error">
            <span className="relay-receiver-error-icon">
              <AlertTriangle size={20} />
            </span>
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null);
                setScanning(true);
              }}
              className="relay-receiver-retry-button"
            >
              Scan Again
            </button>
          </div>
        )}

        {/* QR Scanner */}
        {scanning && !cameraError && !showSuccess && (
          <div className="relay-receiver-scanner">
            <div className="relay-receiver-scanner-wrapper">
              {/* HTML5 QR Code Scanner Container */}
              <div id="qr-reader-region" ref={qrCodeRegionRef}></div>

              {/* Scanning Indicator */}
              <div className="relay-receiver-scanning-indicator">
                <div className="relay-receiver-scan-line"></div>
                <p className="relay-receiver-scanning-text">
                  {chunkProgress
                    ? `Received ${chunkProgress.received.length} of ${chunkProgress.total} parts...`
                    : "Scanning..."}
                </p>
              </div>
            </div>

            {/* Chunk Progress Bar */}
            {chunkProgress && (
              <div className="relay-receiver-chunk-progress">
                <div className="chunk-progress-bar">
                  {Array.from({ length: chunkProgress.total }).map((_, i) => (
                    <div
                      key={i}
                      className={`chunk-segment ${
                        chunkProgress.received.includes(i) ? "received" : ""
                      }`}
                    />
                  ))}
                </div>
                <p className="chunk-progress-text">
                  Scan remaining QR codes in sequence
                </p>
              </div>
            )}
          </div>
        )}

        {/* Success State */}
        {showSuccess && receivedReport && (
          <div className="relay-receiver-success">
            <div className="relay-receiver-success-icon">
              <CheckCircle size={32} />
            </div>
            <h3 className="relay-receiver-success-title">Report Received!</h3>
            <p className="relay-receiver-success-message">
              Data successfully saved offline and will sync when online
            </p>

            {/* Received Report Details */}
            <div className="relay-receiver-report-info">
              <h4 className="relay-receiver-info-title">Received Data:</h4>
              <div className="relay-receiver-info-grid">
                {receivedReport.originalReportId && (
                  <div className="relay-receiver-info-item">
                    <span className="relay-receiver-info-label">
                      Report ID:
                    </span>
                    <span className="relay-receiver-info-value">
                      {receivedReport.originalReportId.substring(0, 8)}...
                    </span>
                  </div>
                )}
                {receivedReport.source && (
                  <div className="relay-receiver-info-item">
                    <span className="relay-receiver-info-label">Source:</span>
                    <span className="relay-receiver-info-value">
                      {receivedReport.source}
                    </span>
                  </div>
                )}
                {receivedReport.location && (
                  <div className="relay-receiver-info-item">
                    <span className="relay-receiver-info-label">Location:</span>
                    <span className="relay-receiver-info-value">
                      {receivedReport.location.lat?.toFixed(4)},{" "}
                      {receivedReport.location.lng?.toFixed(4)}
                    </span>
                  </div>
                )}
                {receivedReport.hasImage ? (
                  <div className="relay-receiver-info-item">
                    <span className="relay-receiver-info-label">Image:</span>
                    <span className="relay-receiver-info-value relay-receiver-has-image">
                      <Image size={14} /> Included
                    </span>
                  </div>
                ) : null}
                <div className="relay-receiver-info-item">
                  <span className="relay-receiver-info-label">Status:</span>
                  <span className="relay-receiver-info-value relay-receiver-status-pending">
                    Pending Sync
                  </span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button onClick={onClose} className="relay-receiver-close-button">
              Close
            </button>
          </div>
        )}

        {/* Instructions */}
        {scanning && !cameraError && !showSuccess && (
          <div className="relay-receiver-instructions">
            <p className="relay-receiver-instructions-title">
              <ClipboardList size={16} className="icon-inline" /> Instructions:
            </p>
            <ul className="relay-receiver-instructions-list">
              <li>Position QR code within the frame</li>
              <li>Hold steady until scan completes</li>
              <li>Ensure good lighting for best results</li>
              <li>Works offline - no internet required</li>
            </ul>
          </div>
        )}

        {/* Cancel Button */}
        {!showSuccess && onClose && (
          <button onClick={onClose} className="relay-receiver-cancel-button">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default RelayReceiver;
