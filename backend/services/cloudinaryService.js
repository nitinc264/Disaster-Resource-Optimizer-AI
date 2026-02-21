import { v2 as cloudinary } from "cloudinary";

const hasUrl = Boolean(process.env.CLOUDINARY_URL);
const hasExplicitCreds =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (hasUrl && !process.env.CLOUDINARY_CLOUD_NAME) {
  // Allow CLOUDINARY_URL to drive config implicitly
  cloudinary.config({ secure: true });
} else if (hasExplicitCreds) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  // Default to secure config so the SDK reads env vars when they become available
  cloudinary.config({ secure: true });
}

const defaultFolder =
  process.env.CLOUDINARY_FOLDER || "disaster-response/reports/photos";

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const UPLOAD_TIMEOUT = 60000; // 60 seconds

function ensureConfigured() {
  if (!hasUrl && !hasExplicitCreds) {
    throw new Error(
      "Cloudinary credentials are missing. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.",
    );
  }
}

/**
 * Delay helper for retry logic
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Single upload attempt with timeout
 */
function attemptUpload(buffer, uploadOptions) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    let uploadStream;

    // Set upload timeout
    timeoutId = setTimeout(() => {
      if (uploadStream) {
        uploadStream.destroy();
      }
      reject(
        new Error(`Upload timeout after ${UPLOAD_TIMEOUT / 1000} seconds`),
      );
    }, UPLOAD_TIMEOUT);

    uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        clearTimeout(timeoutId);
        if (error) {
          return reject(error);
        }
        resolve(result);
      },
    );

    // Handle stream errors
    uploadStream.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    uploadStream.end(buffer);
  });
}

/**
 * Upload image buffer to Cloudinary with retry logic
 */
export async function uploadImageBuffer(buffer, options = {}) {
  ensureConfigured();

  if (!buffer) {
    throw new Error("Image buffer is required for upload");
  }

  const uploadOptions = {
    folder: defaultFolder,
    resource_type: "image",
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    transformation: [{ width: 1600, height: 1600, crop: "limit" }],
    timeout: UPLOAD_TIMEOUT,
    ...options,
  };

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Cloudinary upload attempt ${attempt}/${MAX_RETRIES}...`);
      const result = await attemptUpload(buffer, uploadOptions);
      console.log(`Cloudinary upload successful on attempt ${attempt}`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(
        `Cloudinary upload attempt ${attempt} failed:`,
        error.message,
      );

      // Check if it's a retryable error
      const isRetryable =
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNREFUSED" ||
        error.code === "ENOTFOUND" ||
        error.code === "EAI_AGAIN" ||
        error.message?.includes("timeout") ||
        error.message?.includes("socket hang up");

      if (!isRetryable || attempt === MAX_RETRIES) {
        break;
      }

      // Exponential backoff
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${retryDelay / 1000} seconds...`);
      await delay(retryDelay);
    }
  }

  throw new Error(
    `Cloudinary upload failed after ${MAX_RETRIES} attempts: ${
      lastError?.message || "Unknown error"
    }`,
  );
}
