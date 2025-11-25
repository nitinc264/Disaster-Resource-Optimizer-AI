import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import LZString from "lz-string";
import { AlertTriangle, Radio, Lightbulb } from "lucide-react";
import "./RelaySender.css";

/**
 * RelaySender Component
 * Displays a QR code containing compressed disaster report data
 * for offline peer-to-peer data transfer
 */
const RelaySender = ({ report }) => {
  const [isReady, setIsReady] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [error, setError] = useState(null);

  // Generate QR code value when component mounts or report changes
  useEffect(() => {
    try {
      if (!report) {
        setError("No report data provided");
        return;
      }

      // Convert report to JSON string
      const jsonString = JSON.stringify(report);

      // Compress using LZ-String
      const compressed = LZString.compressToBase64(jsonString);

      // Check if compressed data fits in QR code (max ~2953 bytes for QR v40)
      if (compressed.length > 2900) {
        console.warn("Data might be too large for QR code");
      }

      setQrValue(compressed);
      setIsReady(true);
    } catch (err) {
      console.error("Error generating QR code:", err);
      setError("Failed to generate QR code: " + err.message);
    }
  }, [report]);

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

            {/* Scanning Instructions */}
            <div className="relay-sender-instructions">
              <div className="relay-sender-pulse-dot"></div>
              <p className="relay-sender-instructions-text">
                Ready to scan - Point camera at this QR code
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
              {report.reportId && (
                <div className="relay-sender-info-item">
                  <span className="relay-sender-info-label">Report ID:</span>
                  <span className="relay-sender-info-value">
                    {report.reportId.substring(0, 8)}...
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
              {report.timestamp && (
                <div className="relay-sender-info-item">
                  <span className="relay-sender-info-label">Timestamp:</span>
                  <span className="relay-sender-info-value">
                    {new Date(report.timestamp).toLocaleString()}
                  </span>
                </div>
              )}
              {report.location && (
                <div className="relay-sender-info-item">
                  <span className="relay-sender-info-label">Location:</span>
                  <span className="relay-sender-info-value">
                    {report.location.lat?.toFixed(4)},{" "}
                    {report.location.lng?.toFixed(4)}
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
