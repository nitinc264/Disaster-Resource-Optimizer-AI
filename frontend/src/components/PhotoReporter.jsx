import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Camera,
  Upload,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Send,
} from "lucide-react";
import { getCurrentLocation, uploadPhotoReport } from "../services";
import "./PhotoReporter.css";

const PhotoReporter = () => {
  const { t } = useTranslation();
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [stream, setStream] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [previewUrl, stream]);

  // Attach stream to video element when camera opens
  useEffect(() => {
    if (isCameraOpen && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraOpen, stream]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
    setCameraError(null);
  }, [stream]);

  // Start camera stream
  const startCamera = async () => {
    setError(null);
    setCameraError(null);

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(t("photo.cameraNotSupported"));
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
        },
        audio: false,
      });

      setStream(mediaStream);
      setIsCameraOpen(true);

      // Video element will be attached via useEffect
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(t("photo.cameraError"));
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          handleFileSelect(file);
          stopCamera();
        }
      },
      "image/jpeg",
      0.8
    );
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError(t("photo.invalidFile"));
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError(t("photo.tooLarge", "File too large (max 10MB)"));
      return;
    }

    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setError(null);
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setImageFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    setError(null);

    try {
      // Get location
      let location = null;
      try {
        location = await getCurrentLocation();
      } catch (locErr) {
        console.warn("Could not get location:", locErr);
      }

      await uploadPhotoReport(imageFile, location, caption);

      setUploadSuccess(true);
      setImageFile(null);
      setPreviewUrl(null);
      setCaption("");

      // Reset success message after delay
      setTimeout(() => {
        setUploadSuccess(null);
      }, 3000);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(t("photo.uploadError"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="photo-reporter">
      <div className="photo-reporter-card">
        <div className="photo-reporter-header">
          <div className="photo-reporter-title">
            <Camera size={24} className="text-primary" />
            <h2>{t("photo.title")}</h2>
          </div>
        </div>

        {uploadSuccess ? (
          <div className="success-message">
            <CheckCircle className="success-icon" />
            <h3>{t("photo.uploadSuccess")}</h3>
            <p>{t("photo.uploadSuccess")}</p>
            <button
              className="btn-submit"
              onClick={() => setUploadSuccess(null)}
              style={{ marginTop: "1rem" }}
            >
              {t("photo.takePhoto")}
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div
                className="audio-reporter-error"
                style={{ marginBottom: "1rem" }}
              >
                <AlertTriangle size={20} />
                <p>{error}</p>
              </div>
            )}

            {isCameraOpen ? (
              <div className="camera-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="camera-video"
                  onLoadedMetadata={() => {
                    if (videoRef.current) videoRef.current.play();
                  }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />

                <div className="camera-controls">
                  <button
                    className="camera-snap-btn"
                    onClick={capturePhoto}
                    aria-label={t("photo.capture")}
                  />
                </div>

                <button className="camera-close-btn" onClick={stopCamera}>
                  <X size={20} />
                </button>
              </div>
            ) : !previewUrl ? (
              <div className="photo-input-area">
                <button className="photo-input-btn" onClick={startCamera}>
                  <Camera className="photo-input-icon" />
                  <span className="photo-input-label">
                    {t("photo.takePhoto")}
                  </span>
                </button>

                <button
                  className="photo-input-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="photo-input-icon" />
                  <span className="photo-input-label">{t("photo.chooseFile")}</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleInputChange}
                  accept="image/*"
                  style={{ display: "none" }}
                />
              </div>
            ) : (
              <>
                <div className="photo-preview-container">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="photo-preview-img"
                  />
                  <button
                    className="photo-remove-btn"
                    onClick={handleRemovePhoto}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="photo-caption-container">
                  <label className="photo-caption-label">
                    {t("photo.caption")}
                  </label>
                  <textarea
                    className="photo-caption-input"
                    placeholder={t("photo.captionPlaceholder")}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>

                <div className="photo-actions">
                  <button
                    className="btn-submit"
                    onClick={handleSubmit}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        {t("photo.uploading")}
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        {t("photo.upload")}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {cameraError && (
              <div className="audio-reporter-error">
                <AlertTriangle size={20} />
                <p>{cameraError}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PhotoReporter;
