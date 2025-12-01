# PROMPT FOR GITHUB COPILOT
# -------------------------
# Context: 
# This is a background agent for a disaster response system called "Aegis AI".
# It acts as a "Sentinel" that continuously watches a MongoDB database for new disaster reports.
#
# Technical Requirements:
# 1. Use 'pymongo' to connect to a MongoDB database named 'aegis_db' and collection 'reports'.
# 2. Use 'tensorflow.keras.models' to load a saved model from './model/disaster_model.keras'.
# 3. Create a class names list: ['Fire', 'Flood', 'Rubble', 'Traffic'].
#
# Workflow (Infinite Loop):
# 1. Continuously poll the database (every 2 seconds).
# 2. Look for a document where:
#    - 'status' is 'Pending'
#    - 'imageUrl' exists (is not null)
# 3. If found:
#    - Atomically update 'status' to 'Processing_Visual' (to lock it from other agents).
#    - Download the image from the 'imageUrl' (use 'requests' and 'PIL').
#    - Preprocess the image: Resize to (224, 224), convert to array, normalize (/255.0).
#    - Run model.predict().
#    - Get the class with the highest probability and the confidence score.
#    - Update the document:
#        - Set 'sentinelData' to { tag: class_name, confidence: float_score }.
#        - Set 'status' to 'Analyzed_Visual'.
# 4. Handle errors gracefully (e.g., if image download fails, mark status as 'Error').
# 5. Print logs to the console like "[Sentinel] Processing Report ID..."

# Start coding the imports and the main loop below:
import os
import sys
import time
import warnings
from io import BytesIO
from pathlib import Path

# Suppress protobuf and TensorFlow warnings before importing TensorFlow
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
warnings.filterwarnings('ignore', category=UserWarning, module='google.protobuf')
warnings.filterwarnings('ignore', category=DeprecationWarning)

import numpy as np
import requests
import tensorflow as tf
from dotenv import load_dotenv
from PIL import Image
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import ConfigurationError
from tensorflow.keras.models import load_model

# Resolve project paths and load environment variables
BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

# Configuration (falls back to sensible defaults for local dev)
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://localhost:27017/DisasterResponseDB",
)
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
COLLECTION_NAME = os.getenv("REPORTS_COLLECTION", "reports")
MODEL_PATH = os.getenv(
    "SENTINEL_MODEL_PATH",
    str(BASE_DIR / "models" / "disaster_model.keras"),
)
POLL_INTERVAL = int(os.getenv("SENTINEL_POLL_INTERVAL", 2))  # seconds
RUN_ONCE = os.getenv("SENTINEL_RUN_ONCE", "false").lower() in {"1", "true", "yes"}
MAX_CYCLES = int(os.getenv("SENTINEL_MAX_CYCLES", 0))  # 0 = infinite

# Class names for disaster classification (binary: disaster vs non-disaster)
CLASS_NAMES = ['Non-Disaster', 'Disaster']


@tf.keras.utils.register_keras_serializable(package="Custom")
class CustomF1Score(tf.keras.metrics.Metric):
    """Reimplements the custom metric used when training the model."""

    def __init__(self, name="f1_score", threshold=0.5, average=None, **kwargs):
        super().__init__(name=name, **kwargs)
        self.threshold = threshold
        self.average = average
        self.true_positives = self.add_weight(name="tp", initializer="zeros")
        self.false_positives = self.add_weight(name="fp", initializer="zeros")
        self.false_negatives = self.add_weight(name="fn", initializer="zeros")

    def update_state(self, y_true, y_pred, sample_weight=None):
        y_pred = tf.cast(y_pred >= self.threshold, self.dtype)
        y_true = tf.cast(y_true, self.dtype)

        tp = tf.reduce_sum(y_true * y_pred)
        fp = tf.reduce_sum((1.0 - y_true) * y_pred)
        fn = tf.reduce_sum(y_true * (1.0 - y_pred))

        self.true_positives.assign_add(tp)
        self.false_positives.assign_add(fp)
        self.false_negatives.assign_add(fn)

    def result(self):
        precision = tf.math.divide_no_nan(
            self.true_positives, self.true_positives + self.false_positives
        )
        recall = tf.math.divide_no_nan(
            self.true_positives, self.true_positives + self.false_negatives
        )
        f1 = tf.math.divide_no_nan(2 * precision * recall, precision + recall)
        return f1

    def reset_state(self):
        self.true_positives.assign(0)
        self.false_positives.assign(0)
        self.false_negatives.assign(0)

# Connect to MongoDB
print("[Sentinel] Connecting to MongoDB...")
client = MongoClient(MONGO_URI)

if MONGO_DB_NAME:
    db = client[MONGO_DB_NAME]
else:
    try:
        db = client.get_database()
    except ConfigurationError:
        db = client["DisasterResponseDB"]

collection = db[COLLECTION_NAME]
print(
    f"[Sentinel] Connected to MongoDB '{db.name}' collection '{COLLECTION_NAME}' successfully!"
)

# Load the TensorFlow model
print("[Sentinel] Loading disaster classification model...")
model = load_model(MODEL_PATH)
print("[Sentinel] Model loaded successfully!")


def download_image(image_url):
    """Download image from URL and return PIL Image object."""
    response = requests.get(image_url, timeout=10)
    response.raise_for_status()
    image = Image.open(BytesIO(response.content))
    return image


def preprocess_image(image):
    """Preprocess image for model prediction."""
    # Resize to (224, 224)
    image = image.resize((224, 224))
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    # Convert to numpy array
    image_array = np.array(image)
    # Normalize pixel values to [0, 1]
    image_array = image_array / 255.0
    # Add batch dimension
    image_array = np.expand_dims(image_array, axis=0)
    return image_array


def classify_image(image_array):
    """Run model prediction and return class name and confidence."""
    predictions = model.predict(image_array, verbose=0)
    
    # Handle binary classification (single output neuron with sigmoid)
    if predictions.shape[-1] == 1:
        # Single output: probability of being a disaster
        disaster_prob = float(predictions[0][0])
        if disaster_prob >= 0.5:
            class_name = 'Disaster'
            confidence = disaster_prob
        else:
            class_name = 'Non-Disaster'
            confidence = 1.0 - disaster_prob
    else:
        # Multi-class output (softmax)
        class_index = np.argmax(predictions[0])
        confidence = float(predictions[0][class_index])
        class_name = CLASS_NAMES[class_index] if class_index < len(CLASS_NAMES) else f'Class_{class_index}'
    
    return class_name, confidence


def process_report(report):
    """Process a single report: download image, classify, and update DB."""
    report_id = report['_id']
    image_url = report['imageUrl']
    
    print(f"[Sentinel] Processing Report ID: {report_id}")
    print(f"[Sentinel] Image URL: {image_url}")
    
    try:
        # Download the image
        print(f"[Sentinel] Downloading image...")
        image = download_image(image_url)
        
        # Preprocess the image
        print(f"[Sentinel] Preprocessing image...")
        image_array = preprocess_image(image)
        
        # Classify the image
        print(f"[Sentinel] Running classification...")
        class_name, confidence = classify_image(image_array)
        
        print(f"[Sentinel] Classification Result: {class_name} (Confidence: {confidence:.4f})")
        
        # Update the document with results
        collection.update_one(
            {'_id': report_id},
            {
                '$set': {
                    'sentinelData': {
                        'tag': class_name,
                        'confidence': confidence
                    },
                    'status': 'Analyzed_Visual'
                }
            }
        )
        
        print(f"[Sentinel] Report {report_id} processed successfully!")
        
    except requests.exceptions.RequestException as e:
        print(f"[Sentinel] Error downloading image: {e}")
        collection.update_one(
            {'_id': report_id},
            {'$set': {'status': 'Error', 'errorMessage': f'Image download failed: {str(e)}'}}
        )
        
    except Exception as e:
        print(f"[Sentinel] Error processing report: {e}")
        collection.update_one(
            {'_id': report_id},
            {'$set': {'status': 'Error', 'errorMessage': str(e)}}
        )


def find_and_lock_pending_report():
    """
    Atomically find a pending report with an image and lock it for processing.
    Uses find_one_and_update for atomic operation to prevent race conditions.
    """
    report = collection.find_one_and_update(
        {
            'status': 'Pending',
            'imageUrl': {'$ne': None, '$exists': True}
        },
        {
            '$set': {'status': 'Processing_Visual'}
        },
        return_document=ReturnDocument.AFTER  # Return the locked document
    )
    return report


def main():
    """Main loop: continuously poll database for pending reports."""
    print("[Sentinel] Starting Sentinel Agent...")
    print(f"[Sentinel] Polling interval: {POLL_INTERVAL} seconds")
    print("[Sentinel] Watching for pending reports with images...")
    print("-" * 50)

    cycle_count = 0

    while True:
        try:
            # Find and atomically lock a pending report
            report = find_and_lock_pending_report()
            
            if report:
                process_report(report)
                print("-" * 50)
            else:
                # No pending reports, wait before polling again
                print("[Sentinel] 👁️ No pending visual reports found. Waiting...")
                
        except Exception as e:
            print(f"[Sentinel] Unexpected error in main loop: {e}")
        
        # Wait before next poll
        time.sleep(POLL_INTERVAL)

        cycle_count += 1
        if RUN_ONCE or (MAX_CYCLES and cycle_count >= MAX_CYCLES):
            print("[Sentinel] Reached configured cycle limit. Exiting main loop.")
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[Sentinel] Shutting down gracefully...")
        client.close()
        print("[Sentinel] Disconnected from MongoDB. Goodbye!")
