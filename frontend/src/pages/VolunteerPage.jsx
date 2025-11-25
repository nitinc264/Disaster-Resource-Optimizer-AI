import React, { useState } from "react";
import { ClipboardList, Mic } from "lucide-react";
import { AudioReporter, VolunteerTaskList } from "../components";
import "./VolunteerPage.css";

function VolunteerPage() {
  const [viewMode, setViewMode] = useState("tasks"); // 'tasks' | 'voice'

  return (
    <div className="volunteer-page">
      <header className="page-header">
        <div className="header-text">
          <h1>Field Tasks</h1>
          <p>Complete assigned verifications or report new incidents.</p>
        </div>

        <div className="view-toggle">
          <button
            onClick={() => setViewMode("tasks")}
            className={`toggle-btn ${viewMode === "tasks" ? "active" : ""}`}
          >
            <span className="icon">
              <ClipboardList size={18} />
            </span>
            <span>Checklist</span>
          </button>
          <button
            onClick={() => setViewMode("voice")}
            className={`toggle-btn ${viewMode === "voice" ? "active" : ""}`}
          >
            <span className="icon">
              <Mic size={18} />
            </span>
            <span>Voice Report</span>
          </button>
        </div>
      </header>

      <div className="volunteer-content">
        {viewMode === "voice" ? (
          <div className="content-card">
            <AudioReporter />
          </div>
        ) : (
          <div className="content-card">
            <VolunteerTaskList />
          </div>
        )}
      </div>
    </div>
  );
}

export default VolunteerPage;
