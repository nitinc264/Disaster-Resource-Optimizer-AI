# SMS Chatbot Implementation Guide

## Part 1: The Citizen (SMS Chatbot) - Setup Complete ✅

This implementation uses Twilio for SMS handling, Google's Gemini AI for intelligent triage, and MongoDB for data persistence.

---

## 📁 Files Created

### 1. **`backend/models/Need.js`**
Mongoose schema for storing citizen reports with AI-triaged data.

**Key Features:**
- Stores raw SMS message and phone number
- AI-extracted structured data (needType, location, details, urgency)
- Status tracking (Unverified → Verified → InProgress → Completed)
- Ready for future volunteer/resource linking

### 2. **`backend/services/geminiService.js`**
AI-powered triage service using Google's Gemini API.

**Key Features:**
- Carefully crafted prompt for reliable JSON extraction
- Fallback handling if AI fails
- Validation of AI outputs
- Categorizes needs into: Water, Food, Medical, Rescue, Other
- Urgency classification: Low, Medium, High

### 3. **`backend/routes/smsWebhook.js`**
Express route that receives Twilio webhook calls.

**Key Features:**
- Receives incoming SMS from citizens
- Calls Gemini AI for triage
- Saves to MongoDB
- Sends confirmation SMS back to citizen
- Error handling with user-friendly messages
- Twilio request validation for production security

### 4. **`backend/server.js`** (Updated)
Integrated the SMS webhook with proper middleware.

**Key Updates:**
- Added MongoDB connection
- Added `express.urlencoded()` middleware (required for Twilio)
- Registered SMS webhook route at `/api/sms`
- Enhanced logging for debugging

### 5. **`backend/.env.example`**
Template for environment variables.

---

## 🚀 Setup Instructions

### Step 1: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Fill in your credentials:
   ```env
   MONGO_URI=mongodb+srv://your-connection-string
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   GEMINI_API_KEY=your_gemini_api_key
   ```

**Where to get these:**
- **MongoDB URI**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Twilio Credentials**: [Twilio Console](https://console.twilio.com)
- **Gemini API Key**: [Google AI Studio](https://makersuite.google.com/app/apikey)

### Step 2: Install Dependencies ✅ (Already Done)

All required packages have been installed:
- `twilio` - SMS handling
- `@google/generative-ai` - Gemini AI integration
- `mongoose` - MongoDB ODM

### Step 3: Expose Your Local Server with ngrok

Twilio needs a public URL to send webhooks to your local development server.

1. **Install ngrok** (if not already installed):
   ```bash
   # Windows (using Chocolatey)
   choco install ngrok
   
   # Or download from: https://ngrok.com/download
   ```

2. **Start your backend server**:
   ```bash
   cd backend
   npm start
   ```

3. **In a new terminal, run ngrok**:
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Step 4: Configure Twilio

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your Twilio phone number
4. Scroll to **Messaging Configuration**
5. Under "A MESSAGE COMES IN":
   - **Webhook**: `https://your-ngrok-url.ngrok.io/api/sms`
   - **HTTP Method**: `POST`
6. Click **Save**

---

## 🧪 Testing the Implementation

### Test 1: Send an SMS

From your personal phone, text your Twilio number:

```
Help! We need water and medicine at 123 Main Street. 
My grandmother is sick.
```

### Expected Flow:

1. **Twilio receives the SMS** and forwards it to your webhook
2. **Your server logs**:
   ```
   Incoming message from +1234567890: "Help! We need water..."
   ```
3. **Gemini AI triages** the message:
   ```json
   {
     "needType": "Medical",
     "location": "123 Main Street",
     "details": "Need water and medicine. Grandmother is sick.",
     "urgency": "High"
   }
   ```
4. **Saved to MongoDB** with status: "Unverified"
5. **Confirmation SMS sent back**:
   ```
   Your request has been received and logged. 
   A volunteer will verify it soon. 
   Your Report ID: 507f1f77bcf86cd799439011
   ```

### Test 2: Check MongoDB

You can verify the data was saved by:

1. **Using MongoDB Compass** (GUI)
2. **Using MongoDB Atlas Dashboard**
3. **Using a MongoDB query tool**

Look for a document in the `needs` collection with your message.

---

## 🔍 How to Debug

### View Server Logs
Check your terminal running the backend server for:
- Incoming message details
- Gemini AI triage results
- MongoDB save confirmations
- Any error messages

### Common Issues

**Problem: "MongoDB Connection Error"**
- ✅ Check that `MONGO_URI` in `.env` is correct
- ✅ Ensure your IP is whitelisted in MongoDB Atlas
- ✅ Check network connectivity

**Problem: "Gemini API Error"**
- ✅ Verify `GEMINI_API_KEY` is correct
- ✅ Check API quota/billing in Google AI Studio
- ✅ The fallback will save the raw message if AI fails

**Problem: "Twilio not calling webhook"**
- ✅ Ensure ngrok is running
- ✅ Copy the HTTPS URL (not HTTP)
- ✅ Verify webhook URL in Twilio console
- ✅ Check Twilio Debugger for error logs

---

## 📊 Data Structure Example

Here's what a saved document looks like in MongoDB:

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "fromNumber": "+1234567890",
  "rawMessage": "Help! We need water and medicine at 123 Main Street. My grandmother is sick.",
  "status": "Unverified",
  "triageData": {
    "needType": "Medical",
    "location": "123 Main Street",
    "details": "Need water and medicine. Grandmother is sick.",
    "urgency": "High"
  },
  "createdAt": "2025-11-02T10:30:00.000Z",
  "updatedAt": "2025-11-02T10:30:00.000Z"
}
```

---

## 🎯 Next Steps

You now have a fully functional SMS chatbot! Here's what you can build next:

### Part 2: The Volunteer (Verification Dashboard)
- Create a web dashboard to view unverified needs
- Add buttons to verify/flag reports
- Implement real-time updates

### Part 3: The Manager (Resource Optimization)
- AI-powered resource allocation
- Route optimization
- Real-time tracking

### Enhancements for Part 1:
- [ ] Add support for photo attachments (MMS)
- [ ] Implement conversation memory (multi-turn SMS)
- [ ] Add multilingual support
- [ ] Create SMS-based status updates for citizens
- [ ] Add geolocation parsing for better location detection

---

## 🛡️ Security Notes

**Current State (Development):**
- Twilio webhook validation is disabled in development mode

**Before Production:**
1. Set `NODE_ENV=production` in `.env`
2. This enables Twilio request signature validation
3. Add rate limiting to prevent spam
4. Implement phone number verification
5. Add CORS restrictions

---

## 📞 Support

If you encounter any issues:
1. Check the server logs first
2. Review the Twilio Debugger: https://console.twilio.com/debugger
3. Verify all environment variables are set correctly
4. Ensure ngrok is running and the URL is up-to-date in Twilio

---

**Implementation Status: ✅ COMPLETE**

All files have been created and configured with ES6 module syntax to match your existing codebase. The SMS chatbot is ready for testing!
