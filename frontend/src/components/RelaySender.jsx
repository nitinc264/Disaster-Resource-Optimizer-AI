import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import LZString from "lz-string";
import {
  AlertTriangle,
  Radio,
  Lightbulb,
  Image,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import "./RelaySender.css";

// Keep each QR payload well below the ~18k bit limit react-qr-code enforces
const QR_PAYLOAD_CHAR_LIMIT = 1500;
const CHUNK_DATA_SIZE = 1400; // leaves room for headers per chunk

/**
 * Compress image to a smaller size for QR code transfer
 * Higher quality = more chunks to scan
 * @param {Blob} imageBlob - Original image blob
 * @param {number} maxSize - Max dimension in pixels (default 300 for better quality)
 * @param {number} quality - JPEG quality 0-1 (default 0.6 for balance)
 * @returns {Promise<string>} Base64 encoded compressed image
 */
async function compressImageForRelay(imageBlob, maxSize = 300, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      // Scale down to maxSize while maintaining aspect ratio
      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      // Use better image smoothing for quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to base64 JPEG
      const base64 = canvas.toDataURL("image/jpeg", quality);
      // Remove data URL prefix
      const base64Data = base64.split(",")[1];

      // Revoke object URL to free memory
      URL.revokeObjectURL(img.src);

      resolve(base64Data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = URL.createObjectURL(imageBlob);
  });
}

/**
 * RelaySender Component
 * Displays a QR code containing compressed disaster report data
 * for offline peer-to-peer data transfer
 */
const RelaySender = ({ report }) => {
  const [isReady, setIsReady] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [error, setError] = useState(null);
  const [hasImage, setHasImage] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(1);
  const [qrChunks, setQrChunks] = useState([]);

  // Generate QR code value when component mounts or report changes
  useEffect(() => {
    async function generateQRData() {
      try {
        if (!report) {
          setError("No report data provided");
          setIsReady(false);
          return;
        }

        // Reset error state
        setError(null);

        // Check if report has image
        const reportHasImage = !!(report.imageBlob || report.imageBase64);
        setHasImage(reportHasImage);

        // Normalize report data for relay transfer
        const normalizedReport = {
          reportId: report.reportId || report.id || report._id,
          source: report.source,
          text: report.text,
          location: report.location || {
            lat: report.lat,
            lng: report.lon || report.lng,
          },
          timestamp: report.timestamp || report.createdAt,
          sentinelData: report.sentinelData || {
            tag: report.tag,
            confidence: report.confidence,
          },
          oracleData: report.oracleData || {
            severity: report.severity,
            needs: report.needs || [],
          },
          audioData: report.audioData || {
            transcription: report.transcription,
          },
          hasImage: reportHasImage,
        };

        // If report has image, compress it for relay
        if (reportHasImage) {
          try {
            let imageBase64;
            if (report.imageBlob) {
              // Compress with better quality settings (300px, 60% quality)
              // This will result in ~3-6 QR chunks typically
              imageBase64 = await compressImageForRelay(
                report.imageBlob,
                300,
                0.6
              );
            } else if (report.imageBase64) {
              // Already base64, just use it (might need re-compression)
              imageBase64 = report.imageBase64;
            }

            if (imageBase64) {
              normalizedReport.imageBase64 = imageBase64;
            }
          } catch (imgError) {
            console.warn("Failed to compress image for relay:", imgError);
            // Continue without image
            normalizedReport.hasImage = false;
          }
        }

        // Convert report to JSON string
        const jsonString = JSON.stringify(normalizedReport);

        // Compress using LZ-String
        const compressed = LZString.compressToBase64(jsonString);

        // Check if data fits in a single QR code (tight cap avoids overflow)
        if (compressed.length <= QR_PAYLOAD_CHAR_LIMIT) {
          // Single QR code
          setQrChunks([compressed]);
          setTotalChunks(1);
          setCurrentChunk(0);
          setQrValue(compressed);
        } else {
          // Need to chunk the data
          const chunks = [];
          const totalParts = Math.ceil(compressed.length / CHUNK_DATA_SIZE);

          for (let i = 0; i < totalParts; i++) {
            const chunk = compressed.slice(
              i * CHUNK_DATA_SIZE,
              (i + 1) * CHUNK_DATA_SIZE
            );
            // Add chunk header: RELAY_CHUNK|index|total|data
            const header = `RELAY_CHUNK|${i}|${totalParts}|`;
            chunks.push(`${header}${chunk}`);
          }

          setQrChunks(chunks);
          setTotalChunks(totalParts);
          setCurrentChunk(0);
          setQrValue(chunks[0]);
        }

        setIsReady(true);
      } catch (err) {
        console.error("Error generating QR code:", err);
        setError("Failed to generate QR code: " + err.message);
        setIsReady(false);
      }
    }

    generateQRData();
  }, [report]);

  const handlePrevChunk = () => {
    if (currentChunk > 0) {
      const newChunk = currentChunk - 1;
      setCurrentChunk(newChunk);
      setQrValue(qrChunks[newChunk]);
    }
  };

  const handleNextChunk = () => {
    if (currentChunk < totalChunks - 1) {
      const newChunk = currentChunk + 1;
      setCurrentChunk(newChunk);
      setQrValue(qrChunks[newChunk]);
    }
  };

  return (
    <div className="relay-sender-container">
      <div className="relay-sender-card">
        {/* Header */}
        <div className="relay-sender-header">
          <h2 className="relay-sender-title">
            <span className="relay-sender-icon">
              <Radio size={24} />
            </span>
            Data Relay - Send
          </h2>
          <p className="relay-sender-subtitle">
            Share this QR code with another device to transfer report data
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="relay-sender-error">
            <span className="relay-sender-error-icon">
              <AlertTriangle size={20} />
            </span>
            <p>{error}</p>
          </div>
        )}

        {/* QR Code Display */}
        {isReady && qrValue && !error && (
          <div className="relay-sender-qr-container">
            {/* Image indicator */}
            {hasImage && (
              <div className="relay-sender-image-badge">
                <Image size={14} />
                <span>Contains Image</span>
              </div>
            )}

            <div className="relay-sender-qr-wrapper">
              <QRCode
                value={qrValue}
                size={280}
                level="M"
                fgColor="#000000"
                bgColor="#FFFFFF"
                className="relay-sender-qr-code"
              />
            </div>

            {/* Chunk Navigation (for multi-part QR codes) */}
            {totalChunks > 1 && (
              <div className="relay-sender-chunk-nav">
                <button
                  onClick={handlePrevChunk}
                  disabled={currentChunk === 0}
                  className="chunk-nav-btn"
                  aria-label="Previous chunk"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="chunk-indicator">
                  Part {currentChunk + 1} of {totalChunks}
                </span>
                <button
                  onClick={handleNextChunk}
                  disabled={currentChunk === totalChunks - 1}
                  className="chunk-nav-btn"
                  aria-label="Next chunk"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            {/* Scanning Instructions */}
            <div className="relay-sender-instructions">
              <div className="relay-sender-pulse-dot"></div>
              <p className="relay-sender-instructions-text">
                {totalChunks > 1
                  ? `Scan all ${totalChunks} parts in order`
                  : "Ready to scan - Point camera at this QR code"}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {!isReady && !error && (
          <div className="relay-sender-loading">
            <div className="relay-sender-spinner"></div>
            <p>Generating QR code...</p>
          </div>
        )}

        {/* Report Info */}
        {report && isReady && (
          <div className="relay-sender-info">
            <h3 className="relay-sender-info-title">Report Details</h3>
            <div className="relay-sender-info-grid">
              {(report.reportId || report.id) && (
                <div className="relay-sender-info-item">
                  <span className="relay-sender-info-label">Report ID:</span>
                  <span className="relay-sender-info-value">
                    {(report.reportId || report.id).substring(0, 8)}...
                  </span>
                </div>
              )}
              {report.source && (
                <div className="relay-sender-info-item">
                  <span className="relay-sender-info-label">Source:</span>
                  <span className="relay-sender-info-value">
                    {report.source}
                  </span>
                </div>
              )}
              {(report.timestamp || report.createdAt) && (
                <div className="relay-sender-info-item">
                  <span className="relay-sender-info-label">Timestamp:</span>
                  <span className="relay-sender-info-value">
                    {new Date(
                      report.timestamp || report.createdAt
                    ).toLocaleString()}
                  </span>
                </div>
              )}
              {(report.location || report.lat) && (
                <div className="relay-sender-info-item">
                  <span className="relay-sender-info-label">Location:</span>
                  <span className="relay-sender-info-value">
                    {(report.location?.lat || report.lat)?.toFixed(4)},{" "}
                    {(report.location?.lng || report.lon)?.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="relay-sender-tips">
          <p className="relay-sender-tips-title">
            <Lightbulb size={16} className="icon-inline" /> Tips for best
            results:
          </p>
          <ul className="relay-sender-tips-list">
            <li>Increase screen brightness for outdoor scanning</li>
            <li>Hold steady and keep QR code centered</li>
            <li>Avoid glare and direct sunlight on screen</li>
            <li>Works offline - no internet required</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RelaySender;
