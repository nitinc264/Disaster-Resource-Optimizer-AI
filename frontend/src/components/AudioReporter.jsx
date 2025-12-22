import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";
import {
  Mic,
  AlertTriangle,
  Hourglass,
  CheckCircle,
  Upload,
  Trash2,
} from "lucide-react";
import { uploadAudioReport, getCurrentLocation } from "../services";
import "./AudioReporter.css";

const AudioReporter = () => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState("prompt"); // 'granted', 'denied', 'prompt'
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);

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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [audioUrl]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      setRecordingTime(0);

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

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setPermissionStatus("denied");
      setError(t("audio.permissionDenied"));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleDiscard = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setError(null);
    setUploadSuccess(null);
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    setIsUploading(true);
    setError(null);

    try {
      // Get location
      let location = null;
      try {
        location = await getCurrentLocation();
      } catch (locErr) {
        console.warn("Could not get location:", locErr);
        // Continue without location
      }

      const reportId = uuidv4();
      const file = new File([audioBlob], `voice-report-${reportId}.webm`, {
        type: "audio/webm",
      });

      await uploadAudioReport(file, location);

      setUploadSuccess(true);
      setAudioBlob(null);
      setAudioUrl(null);

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadSuccess(null);
      }, 3000);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(t("audio.uploadError"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="audio-reporter-container">
      <div className="audio-reporter-card">
        <div className="audio-reporter-title">
          <Mic size={24} className="text-primary" />
          <span>{t("audio.title")}</span>
        </div>

        {uploadSuccess ? (
          <div className="success-message">
            <CheckCircle className="success-icon" />
            <h3>{t("audio.uploadSuccess")}</h3>
            <p>{t("audio.transcriptionPending")}</p>
            <button
              className="btn-action btn-primary btn-full"
              onClick={() => setUploadSuccess(null)}
            >
              {t("audio.holdToRecord")}
            </button>
          </div>
        ) : (
          <>
            <p className="audio-reporter-subtitle">
              {isRecording
                ? t("audio.recording")
                : audioUrl
                ? t("audio.preview")
                : t("audio.recordingHint")}
            </p>

            {error && (
              <div className="audio-reporter-error">
                <AlertTriangle size={20} />
                <p>{error}</p>
              </div>
            )}

            {!audioUrl ? (
              <div className="recording-controls">
                <div className="mic-button-wrapper">
                  {isRecording && <div className="mic-ripple" />}
                  <button
                    className={`mic-button ${isRecording ? "recording" : ""}`}
                    onClick={handleToggleRecording}
                    aria-label={
                      isRecording ? "Stop" : "Start"
                    }
                  >
                    {isRecording ? (
                      <div
                        className="stop-icon"
                        style={{
                          width: 24,
                          height: 24,
                          background: "white",
                          borderRadius: 4,
                        }}
                      />
                    ) : (
                      <Mic size={40} />
                    )}
                  </button>
                </div>
                <div className="recording-status">
                  {isRecording ? (
                    <span className="recording-timer">
                      {formatTime(recordingTime)}
                    </span>
                  ) : (
                    <span>{t("audio.holdToRecord")}</span>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="audio-player-wrapper">
                  <audio src={audioUrl} controls className="audio-player" />
                </div>

                <div className="audio-actions">
                  <button
                    className="btn-action btn-secondary"
                    onClick={handleDiscard}
                    disabled={isUploading}
                  >
                    <Trash2 size={18} />
                    {t("audio.discard")}
                  </button>

                  <button
                    className="btn-action btn-primary"
                    onClick={handleUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Hourglass size={18} className="animate-spin" />
                        {t("audio.uploading")}
                      </>
                    ) : (
                      <>
                        <Upload size={18} />
                        {t("audio.upload")}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AudioReporter;
