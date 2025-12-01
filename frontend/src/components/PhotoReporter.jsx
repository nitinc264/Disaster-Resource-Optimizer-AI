import { useEffect, useRef, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Camera,
  Upload,
  MapPin,
  RefreshCcw,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  ImageIcon,
} from "lucide-react";
import { getCurrentLocation, uploadPhotoReport, db } from "../services";
import "./PhotoReporter.css";

const PhotoReporter = () => {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [locationStatus, setLocationStatus] = useState(
    "Location will be attached automatically"
  );
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [stream, setStream] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Online/offline detection
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleOnlineChange = () => {
      setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    };

    window.addEventListener("online", handleOnlineChange);
    window.addEventListener("offline", handleOnlineChange);

    return () => {
      window.removeEventListener("online", handleOnlineChange);
      window.removeEventListener("offline", handleOnlineChange);
    };
  }, []);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Stop camera stream when component unmounts or camera closes
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
    setCameraError(null);
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Start camera stream
  const startCamera = async () => {
    setError(null);
    setCameraError(null);

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Camera not supported in this browser. Please use the file picker."
      );
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setIsCameraOpen(true);

      // Wait for video element to be available
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err) {
      console.error("Camera access error:", err);
      if (err.name === "NotAllowedError") {
        setCameraError(
          "Camera access denied. Please allow camera permissions and try again."
        );
      } else if (err.name === "NotFoundError") {
        setCameraError("No camera found on this device.");
      } else if (err.name === "NotReadableError") {
        setCameraError("Camera is in use by another application.");
      } else {
        setCameraError(`Could not access camera: ${err.message}`);
      }
    }
  };

  // Capture photo from video stream
  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          clearPreview();
          setImageFile(file);
          setPreviewUrl(URL.createObjectURL(blob));
          setError(null);
          setStatus(null);
          setLocationStatus("Location will be attached automatically");
          stopCamera();
        }
      },
      "image/jpeg",
      0.9
    );
  };

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setImageFile(null);
    setPreviewUrl(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    clearPreview();
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setStatus(null);
    setCameraError(null);
    setLocationStatus("Location will be attached automatically");
  };

  const handleCaptureClick = () => {
    // Try to open camera first
    startCamera();
  };

  const handleFilePickerClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleDiscard = () => {
    clearPreview();
    setCaption("");
    setError(null);
    setStatus(null);
    setCameraError(null);
    setLocationStatus("Location will be attached automatically");
  };

  const persistOfflinePhotoReport = async (file, location, description) => {
    const offlineId = uuidv4();
    const blobCopy =
      file instanceof Blob ? file.slice(0, file.size, file.type) : file;

    await db.offlineReports.put({
      id: offlineId,
      reportId: offlineId,
      type: "photo",
      source: "Visual Reporter",
      text: description,
      caption: description,
      timestamp: Date.now(),
      location: {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      },
      synced: 0,
      hasImage: true,
      imageBlob: blobCopy,
    });

    return offlineId;
  };

  const handleUpload = async () => {
    if (!imageFile) {
      setError("Capture a photo before uploading");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setStatus(null);
      setLocationStatus("Locking current location...");

      let location;
      try {
        location = await getCurrentLocation();
        setLocationStatus(
          `Location locked: ${location.lat.toFixed(4)}, ${location.lng.toFixed(
            4
          )}`
        );
      } catch (locErr) {
        // Fallback: allow report without precise location when offline
        console.warn("Location unavailable:", locErr.message);
        location = { lat: 0, lng: 0, accuracy: null };
        setLocationStatus(
          "Location unavailable – report will save without coordinates"
        );
      }

      const trimmedCaption = caption.trim();

      if (!isOnline) {
        const offlineId = await persistOfflinePhotoReport(
          imageFile,
          location,
          trimmedCaption
        );

        setStatus({
          message:
            "Photo saved offline. It will sync automatically when back online.",
          imageUrl: null,
          reportId: offlineId,
        });
      } else {
        const response = await uploadPhotoReport(
          imageFile,
          location,
          trimmedCaption
        );

        setStatus({
          message:
            response.message || "Photo uploaded successfully. Thank you!",
          imageUrl: response.data?.imageUrl,
          reportId: response.data?.id,
        });
      }

      clearPreview();
      setCaption("");
      setLocationStatus("Location will be attached automatically");
    } catch (uploadError) {
      setError(uploadError.message || "Failed to upload photo report");
      setLocationStatus("Location will be attached automatically");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="photo-reporter">
      <div className="photo-reporter-header">
        <div className="photo-reporter-title">
          <span className="photo-reporter-icon">
            <Camera size={22} />
          </span>
          <div>
            <h2>Visual Report</h2>
            <p>Capture on-ground visuals for the Sentinel agent.</p>
          </div>
        </div>
        {!isOnline && <span className="photo-reporter-offline">Offline</span>}
      </div>

      {error && (
        <div className="photo-reporter-alert error">
          <AlertTriangle size={18} />
          <p>{error}</p>
        </div>
      )}

      {cameraError && (
        <div className="photo-reporter-alert warning">
          <AlertTriangle size={18} />
          <div>
            <p>{cameraError}</p>
            <button
              type="button"
              className="photo-btn-link"
              onClick={handleFilePickerClick}
            >
              Use file picker instead
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="photo-reporter-alert success">
          <CheckCircle size={18} />
          <div>
            <p>{status.message}</p>
            {status.imageUrl && (
              <a href={status.imageUrl} target="_blank" rel="noreferrer">
                View uploaded photo
              </a>
            )}
          </div>
        </div>
      )}

      {/* Camera View */}
      {isCameraOpen && (
        <div className="camera-modal">
          <div className="camera-container">
            <button
              type="button"
              className="camera-close-btn"
              onClick={stopCamera}
              aria-label="Close camera"
            >
              <X size={24} />
            </button>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
            <div className="camera-controls">
              <button
                type="button"
                className="camera-capture-btn"
                onClick={captureFromCamera}
                aria-label="Take photo"
              >
                <Camera size={32} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Photo Preview */}
      {previewUrl ? (
        <div className="photo-preview has-preview">
          <img src={previewUrl} alt="Captured scene" />
        </div>
      ) : (
        <button
          type="button"
          className="photo-preview placeholder clickable"
          onClick={handleCaptureClick}
          disabled={isCameraOpen}
        >
          <div className="photo-preview-placeholder">
            <Camera size={48} />
            <p>Tap here to open camera</p>
          </div>
        </button>
      )}

      {/* Hidden file input for fallback */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <label className="photo-caption-label" htmlFor="photo-report-caption">
        Situation (optional)
      </label>
      <textarea
        id="photo-report-caption"
        placeholder="What are you seeing on the ground?"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={3}
      />

      <div className="photo-reporter-location">
        <MapPin size={18} />
        <p>{locationStatus}</p>
      </div>

      <div className="photo-reporter-actions">
        <button
          type="button"
          className="photo-btn secondary"
          onClick={handleFilePickerClick}
        >
          <ImageIcon size={16} /> Gallery
        </button>

        <button
          type="button"
          className="photo-btn ghost"
          onClick={handleDiscard}
          disabled={!previewUrl && !caption}
        >
          Clear
        </button>

        <button
          type="button"
          className="photo-btn primary"
          onClick={handleUpload}
          disabled={!imageFile || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 size={16} className="spin" /> Uploading...
            </>
          ) : (
            <>
              <Upload size={16} /> {isOnline ? "Send" : "Save Offline"}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PhotoReporter;
