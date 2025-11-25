import { useState } from "react";
import { Upload, Download } from "lucide-react";
import { RelaySender, RelayReceiver } from "../components";
import "./DataRelayPage.css";

const DataRelayPage = () => {
  const [mode, setMode] = useState("send"); // 'send' | 'receive'
  const [receivedReports, setReceivedReports] = useState([]);

  const handleReceiveSuccess = (report) => {
    console.log("Report received successfully:", report);
    setReceivedReports((prev) => [...prev, report]);
  };

  return (
    <div className="relay-page">
      <header className="relay-header">
        <div className="header-content">
          <h1>Data Relay</h1>
          <p>Secure offline peer-to-peer synchronization.</p>
        </div>

        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === "send" ? "active" : ""}`}
            onClick={() => setMode("send")}
          >
            <span className="icon">
              <Upload size={18} />
            </span>
            <span>Send Data</span>
          </button>
          <button
            className={`mode-btn ${mode === "receive" ? "active" : ""}`}
            onClick={() => setMode("receive")}
          >
            <span className="icon">
              <Download size={18} />
            </span>
            <span>Receive Data</span>
          </button>
        </div>
      </header>

      <div className="relay-content">
        <div className="relay-card">
          {mode === "send" ? (
            <div className="relay-panel">
              <div className="panel-header">
                <h2>Broadcast Mode</h2>
                <span className="status-badge ready">Ready to Transmit</span>
              </div>
              <p className="panel-desc">
                Generate a QR code to transfer cached reports to a nearby device
                or hub.
              </p>
              <RelaySender />
            </div>
          ) : (
            <div className="relay-panel">
              <div className="panel-header">
                <h2>Scanner Mode</h2>
                <span className="status-badge active">Camera Active</span>
              </div>
              <p className="panel-desc">
                Scan a QR code from a volunteer device to ingest field reports.
              </p>
              {mode === "receive" && (
                <RelayReceiver
                  key="relay-receiver"
                  onSuccess={handleReceiveSuccess}
                />
              )}

              {receivedReports.length > 0 && (
                <div className="received-log">
                  <h3>Session Log</h3>
                  <div className="log-list">
                    {receivedReports.map((report, i) => (
                      <div key={i} className="log-item">
                        <span className="log-time">
                          {new Date(report.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="log-id">
                          ID: {report.reportId.slice(0, 8)}...
                        </span>
                        <span className="log-status">Synced</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataRelayPage;
