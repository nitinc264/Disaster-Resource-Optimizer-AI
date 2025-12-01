import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Mic,
  AlertTriangle,
  Lock,
  Hourglass,
  CheckCircle,
  Upload,
  Save,
  Trash2,
  WifiOff,
} from "lucide-react";
import { uploadAudioReport, getCurrentLocation, db } from "../services";
import "./AudioReporter.css";

const AudioReporter = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState("prompt"); // 'granted', 'denied', 'prompt'
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Check microphone permission on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" })
        .then((permissionStatus) => {
          setPermissionStatus(permissionStatus.state);
          permissionStatus.onchange = () => {
            setPermissionStatus(permissionStatus.state);
          };
        })
        .catch(() => {
          // Fallback if permission API not supported
          setPermissionStatus("prompt");
        });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionStatus("granted");

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // When recording stops, create blob
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setPermissionStatus("denied");

      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        setError(
          "Microphone access denied. Please enable microphone permissions in your browser settings."
        );
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        setError(
          "No microphone found. Please connect a microphone and try again."
        );
      } else if (
        err.name === "NotReadableError" ||
        err.name === "TrackStartError"
      ) {
        setError(
          "Microphone is already in use by another application. Please close other apps using the microphone."
        );
      } else {
        setError(`Failed to access microphone: ${err.message}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleMouseDown = () => {
    startRecording();
  };

  const handleMouseUp = () => {
    stopRecording();
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    startRecording();
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    stopRecording();
  };

  const uploadToBackend = async () => {
    if (!audioBlob) return;

    try {
      setIsUploading(true);
      setError(null);
      setUploadSuccess(null);

      // Get current location
      const userLocation = await getCurrentLocation();

      // Upload audio to backend
      const result = await uploadAudioReport(audioBlob, userLocation);

      // Check if transcription is pending
      const isPending = result.pending || !result.report?.transcription;

      // Show success with transcription or pending message
      setUploadSuccess({
        transcription: result.report?.transcription || null,
        analysis: result.report?.analysis,
        pending: isPending,
        message: isPending
          ? "Audio uploaded successfully! Transcription will be processed when API quota is available."
          : result.message || "Audio processed successfully",
      });

      // Reset audio state after delay (longer if pending)
      setTimeout(
        () => {
          setAudioBlob(null);
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }
          setAudioUrl(null);
          setUploadSuccess(null);
        },
        isPending ? 7000 : 5000
      );
    } catch (err) {
      console.error("Error uploading audio:", err);
      setError(
        err.message || "Failed to upload audio report. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const saveToOfflineStore = async () => {
    if (!audioBlob) return;

    try {
      setIsSaving(true);
      setError(null);

      // Get current location
      const userLocation = await getCurrentLocation();

      const reportId = uuidv4();

      const reportData = {
        id: reportId,
        type: "audio",
        blob: audioBlob,
        location: userLocation,
        timestamp: Date.now(),
        synced: false,
      };

      // Save to Dexie
      await db.offlineReports.add(reportData);

      // Reset state
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(null);
      setError(null);

      // Show success feedback
      alert(
        "✓ Audio report saved offline. It will sync when you're back online."
      );
    } catch (err) {
      console.error("Error saving to offline store:", err);
      setError(err.message || "Failed to save audio report. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setError(null);
  };

  return (
    <div className="audio-reporter-container">
      <div className="audio-reporter-card">
        <h2 className="audio-reporter-title">
          <span className="audio-reporter-icon">
            <Mic size={24} />
          </span>
          Voice Report
        </h2>

        {/* Error Display */}
        {error && (
          <div className="audio-reporter-error">
            <span className="audio-reporter-error-icon">
              <AlertTriangle size={20} />
            </span>
            <p>{error}</p>
          </div>
        )}

        {/* Permission Warning */}
        {permissionStatus === "denied" && !error && (
          <div className="audio-reporter-warning">
            <span className="audio-reporter-warning-icon">
              <Lock size={20} />
            </span>
            <p>
              Microphone access is blocked. Enable permissions in your browser
              settings to record audio reports.
            </p>
          </div>
        )}

        {/* Preview Player */}
        {audioUrl && !isRecording && (
          <div className="audio-reporter-preview">
            <p className="audio-reporter-preview-label">
              Preview Your Recording:
            </p>
            <audio src={audioUrl} controls className="audio-reporter-player" />
          </div>
        )}

        {/* Recording Button */}
        {!audioUrl && (
          <div className="audio-reporter-record-section">
            <button
              className={`audio-reporter-record-button ${
                isRecording ? "recording" : ""
              }`}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => isRecording && handleMouseUp()}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              disabled={permissionStatus === "denied"}
              aria-label={
                isRecording ? "Recording - Release to stop" : "Hold to record"
              }
            >
              <div className="audio-reporter-record-circle">
                {isRecording && <div className="audio-reporter-pulse"></div>}
              </div>
              <span className="audio-reporter-record-text">
                {isRecording
                  ? "Recording... Release to Stop"
                  : "Hold to Record"}
              </span>
            </button>

            {isRecording && (
              <p className="audio-reporter-recording-indicator">
                <span className="audio-reporter-dot"></span>
                Recording in progress...
              </p>
            )}
          </div>
        )}

        {/* Success Message */}
        {uploadSuccess && (
          <div
            className={`audio-reporter-success ${
              uploadSuccess.pending ? "audio-reporter-pending" : ""
            }`}
          >
            <span className="audio-reporter-success-icon">
              {uploadSuccess.pending ? (
                <Hourglass size={24} />
              ) : (
                <CheckCircle size={24} />
              )}
            </span>
            <div className="audio-reporter-success-content">
              <p className="audio-reporter-success-title">
                {uploadSuccess.pending
                  ? "Audio Uploaded - Processing Pending"
                  : "Report Submitted Successfully!"}
              </p>
              {uploadSuccess.message && (
                <p className="audio-reporter-success-message">
                  {uploadSuccess.message}
                </p>
              )}
              {uploadSuccess.transcription && (
                <div className="audio-reporter-transcription">
                  <strong>Transcription:</strong>
                  <p>{uploadSuccess.transcription}</p>
                </div>
              )}
              {uploadSuccess.analysis && (
                <div className="audio-reporter-analysis">
                  <p>
                    <strong>Type:</strong> {uploadSuccess.analysis.tag} |{" "}
                    <strong>Severity:</strong> {uploadSuccess.analysis.severity}
                    /10
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons (Upload/Save/Discard) */}
        {audioUrl && !isRecording && !uploadSuccess && (
          <div className="audio-reporter-actions">
            {navigator.onLine && (
              <button
                onClick={uploadToBackend}
                disabled={isUploading || isSaving}
                className="audio-reporter-upload-button"
              >
                {isUploading ? (
                  <>
                    <span className="audio-reporter-spinner"></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <span className="audio-reporter-upload-icon">
                      <Upload size={18} />
                    </span>
                    Upload & Process
                  </>
                )}
              </button>
            )}

            <button
              onClick={saveToOfflineStore}
              disabled={isSaving || isUploading}
              className="audio-reporter-save-button"
            >
              {isSaving ? (
                <>
                  <span className="audio-reporter-spinner"></span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="audio-reporter-save-icon">
                    <Save size={18} />
                  </span>
                  Save Offline
                </>
              )}
            </button>

            <button
              onClick={discardRecording}
              disabled={isSaving || isUploading}
              className="audio-reporter-discard-button"
            >
              <span className="audio-reporter-discard-icon">
                <Trash2 size={18} />
              </span>
              Discard
            </button>
          </div>
        )}

        {/* Offline Indicator */}
        {!navigator.onLine && (
          <div className="audio-reporter-offline-badge">
            <span className="audio-reporter-offline-icon">
              <WifiOff size={16} />
            </span>
            Offline Mode - Reports will sync automatically
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioReporter;
