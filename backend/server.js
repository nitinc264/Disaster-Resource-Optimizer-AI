import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import smsWebhookRoutes from './routes/smsWebhook.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Connect to MongoDB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// --- Middlewares ---
app.use(cors());

// CRITICAL for Twilio: This parses the 'application/x-www-form-urlencoded' payload from Twilio
app.use(express.urlencoded({ extended: false }));

// Standard JSON middleware (for other routes)
app.use(express.json());

// --- Register Routes ---
// SMS Webhook for Twilio - All incoming SMS messages will be handled here
app.use('/api', smsWebhookRoutes);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Disaster Response Resource Optimization Platform API' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Twilio Webhook URL: http://localhost:${PORT}/api/sms`);
  console.log(`Use ngrok to expose this URL for Twilio webhook configuration`);
});
