# Disaster Response Resource Optimization Platform

An AI-powered platform for optimizing disaster response through intelligent SMS triage, volunteer coordination, and resource allocation.

## 🌟 Features

### Part 1: SMS Chatbot (Citizen Interface) ✅ IMPLEMENTED

- **AI-Powered Triage**: Uses Google Gemini AI to automatically categorize and prioritize incoming citizen reports
- **SMS Integration**: Citizens text their needs to a Twilio number
- **Intelligent Classification**: Automatically categorizes needs (Water, Food, Medical, Rescue, Other)
- **Urgency Detection**: AI assigns urgency levels (Low, Medium, High) based on message content
- **Automated Responses**: Sends confirmation SMS with unique Report ID
- **MongoDB Storage**: All reports stored with structured data for easy processing

### Part 2: Volunteer Dashboard ✅ IMPLEMENTED

- Web interface for volunteers to verify citizen reports
- Real-time updates and notifications
- Verification workflow

### Part 3: Manager & Resource Optimization ✅ IMPLEMENTED

- AI-powered resource allocation
- Route optimization for resource delivery
- Real-time tracking and analytics

## Project Structure

This project consists of a React Vite frontend and a Node.js Express backend.

```
├── frontend/                      # React Vite application
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   │   ├── Map.jsx/css       # ✅ Leaflet map container
│   │   │   ├── MapPin.jsx/css    # ✅ Custom map markers
│   │   │   ├── RouteLine.jsx/css # ✅ Route visualization
│   │   │   ├── SyncStatus.jsx/css # ✅ Offline sync indicator
│   │   │   ├── VolunteerTaskList.jsx/css # ✅ Task verification list
│   │   │   └── index.js          # Component exports
│   │   ├── pages/                # Page-level components
│   │   │   ├── DashboardPage.jsx/css # ✅ Manager dashboard
│   │   │   ├── VolunteerPage.jsx/css # ✅ Volunteer portal
│   │   │   └── index.js          # Page exports
│   │   ├── services/             # API and data services
│   │   │   ├── api.js            # ✅ Route optimization API
│   │   │   ├── apiService.js     # ✅ Task/needs API
│   │   │   ├── verificationService.js # ✅ Offline-first verification
│   │   │   ├── db.js             # ✅ IndexedDB (Dexie) setup
│   │   │   └── index.js          # Service exports
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── useSyncManager.js # ✅ Offline sync manager
│   │   │   └── index.js          # Hook exports
│   │   ├── App.jsx/css           # ✅ Root app component
│   │   ├── main.jsx              # ✅ React entry point
│   │   └── index.css             # ✅ Global styles & CSS variables
│   └── package.json
├── backend/                  # Node.js Express server
│   ├── app.js                # Express app factory (middlewares + routes)
│   ├── server.js             # Startup/bootstrap logic
│   ├── controllers/          # Request handlers
│   │   ├── smsController.js  # ✅ Twilio webhook orchestration
│   │   ├── taskController.js # ✅ Volunteer/task endpoints
│   │   └── routeController.js # ✅ Route optimization handler
│   ├── routes/               # API route registrations
│   │   ├── index.js          # ✅ Central router
│   │   ├── smsWebhook.js     # ✅ SMS webhook route
│   │   ├── tasks.js          # ✅ Need/task routes
│   │   └── optimization.js   # ✅ Route optimization
│   ├── services/             # Business logic services
│   │   ├── geminiService.js  # ✅ AI triage service
│   │   ├── geocodeService.js # ✅ Location geocoding
│   │   └── routeOptimizationService.js # ✅ TSP solver
│   ├── models/               # Mongoose schemas
│   │   └── Need.js           # ✅ Citizen report schema
│   ├── utils/
│   │   └── smsParser.js      # ✅ Fallback parsing helpers
│   ├── config/
│   │   ├── index.js          # ✅ Environment config
│   │   └── database.js       # ✅ MongoDB connection
│   ├── SETUP_GUIDE.md        # ✅ Comprehensive setup instructions
│   ├── QUICK_START.md        # ✅ 5-minute quick start
│   ├── CHECKLIST.md          # ✅ Implementation checklist
│   └── test-sms-webhook.js   # ✅ Testing script
└── package.json              # Root package.json with scripts
```

## 🚀 Getting Started

### Prerequisites

1. **Node.js** (v16 or higher)
2. **MongoDB Atlas** account (or local MongoDB)
3. **Twilio** account with phone number
4. **Google Gemini API** key
5. **ngrok** for local webhook testing

### Quick Installation

1. **Install all dependencies:**

   ```bash
   npm run install:all
   ```

2. **Configure Backend Environment:**

   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Required Environment Variables:**

   ```env
   MONGO_URI=mongodb+srv://...
   TWILIO_ACCOUNT_SID=ACxxxxx...
   TWILIO_AUTH_TOKEN=your_token
   GEMINI_API_KEY=your_key
   ```

4. **Test the Setup:**
   ```bash
   cd backend
   node test-sms-webhook.js
   ```

### Running the Application

**Run both frontend and backend:**

```bash
npm run dev
```

**Or run separately:**

```bash
npm run frontend  # Runs on http://localhost:5173
npm run backend   # Runs on http://localhost:3000
```

### SMS Chatbot Setup

For detailed SMS chatbot setup and testing:

1. **📖 Read the Setup Guide:**

   - See `backend/SETUP_GUIDE.md` for comprehensive instructions

2. **⚡ Quick Start (5 minutes):**

   - See `backend/QUICK_START.md` for rapid deployment

3. **✅ Follow the Checklist:**
   - See `backend/CHECKLIST.md` to ensure everything is configured

### Development

- **Frontend**: React + Vite (http://localhost:5173)
- **Backend**: Node.js + Express (http://localhost:3000)
- **SMS Webhook**: `/api/sms` (exposed via ngrok)

## 📱 SMS Chatbot Usage

### For Citizens

1. **Send a text message** to your configured Twilio number:

   ```
   Help! We need water and medicine at 123 Main Street.
   My grandmother is sick.
   ```

2. **Receive confirmation:**
   ```
   Your request has been received and logged.
   A volunteer will verify it soon.
   Your Report ID: 507f1f77bcf86cd799439011
   ```

### What Happens Behind the Scenes

1. **Twilio** receives the SMS and forwards it to your webhook
2. **Gemini AI** analyzes the message and extracts:
   - **Need Type**: Medical, Water, Food, Rescue, or Other
   - **Location**: 123 Main Street
   - **Details**: Need water and medicine. Grandmother is sick.
   - **Urgency**: High, Medium, or Low
3. **MongoDB** stores the structured data
4. **Twilio** sends confirmation SMS back to the citizen

## 🧪 Testing

### Automated Testing

```bash
cd backend
node test-sms-webhook.js
```

This will:

- ✅ Verify all environment variables
- ✅ Test Gemini AI triage with sample messages
- ✅ Test MongoDB connection
- ✅ Create and delete a test document

### Manual SMS Testing

Send these test messages to your Twilio number:

**Medical Emergency:**

```
URGENT: My father has chest pain. We're at 456 Oak Avenue. Need ambulance!
```

**Water Request:**

```
We need drinking water for 10 people at Central Community Center
```

**Rescue:**

```
Trapped in basement at 789 Pine Street. Water rising fast!
```

**Food:**

```
Need food for 3 families near the park on Main Street
```

## 🏗️ Architecture

### Data Flow

```
Citizen (SMS) → Twilio → Webhook (/api/sms) → Gemini AI → MongoDB
                  ↓                                          ↓
            Confirmation SMS ←────────────────────────────────
```

### Technology Stack

**Backend:**

- Node.js + Express (API server)
- Mongoose (MongoDB ODM)
- Twilio (SMS gateway)
- Google Gemini AI (NLP triage)

**Frontend:**

- React + Vite
- (Volunteer dashboard - coming soon)

**Database:**

- MongoDB Atlas (cloud-hosted)

## 📚 Documentation

- **`backend/SETUP_GUIDE.md`** - Comprehensive setup and troubleshooting
- **`backend/QUICK_START.md`** - 5-minute quick start guide
- **`backend/CHECKLIST.md`** - Step-by-step implementation checklist
- **`backend/IMPLEMENTATION_SUMMARY.md`** - Technical implementation details

## 🔐 Security

**Development Mode:**

- Twilio webhook validation disabled for easier testing

**Production Recommendations:**

- Set `NODE_ENV=production` to enable Twilio signature validation
- Implement rate limiting
- Add phone number verification
- Use HTTPS for all endpoints
- Regularly rotate API keys

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

### Common Issues

| Issue            | Solution                                          |
| ---------------- | ------------------------------------------------- |
| SMS not received | Check ngrok is running, verify Twilio webhook URL |
| MongoDB error    | Verify MONGO_URI, check IP whitelist in Atlas     |
| Gemini API error | Verify API key, check quota limits                |
| 500 error        | Check server logs for details                     |

### Getting Help

1. Check the `SETUP_GUIDE.md` for detailed troubleshooting
2. Review server logs for error messages
3. Check Twilio Debugger: https://console.twilio.com/debugger
4. Verify all environment variables are set correctly

## 🎯 Roadmap

- [x] **Part 1: SMS Chatbot** - AI-powered citizen reporting
- [ ] **Part 2: Volunteer Dashboard** - Web interface for verification
- [ ] **Part 3: Resource Optimization** - AI-powered allocation and routing
- [ ] **Part 4: Analytics Dashboard** - Real-time insights and reporting
- [ ] **Part 5: Mobile Apps** - Native iOS/Android applications

## 📊 Current Status

**✅ Implemented:**

- SMS reception via Twilio
- AI-powered triage with Gemini
- MongoDB data persistence
- Automated confirmation messages
- Comprehensive documentation
- Testing scripts

**🚧 In Progress:**

- Volunteer verification dashboard

**📅 Planned:**

- Resource allocation system
- Route optimization
- Real-time tracking
- Multi-language support

---

**Built with ❤️ for disaster response teams worldwide**

## Environment Variables

Backend uses `.env` file for configuration. See `backend/.env.example` for all available options.

### Media Upload Configuration

Add the following when enabling photo capture uploads:

```
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
# Optional overrides:
# CLOUDINARY_FOLDER=disaster-response/reports/photos
```

The `CLOUDINARY_URL` value is provided by Cloudinary and contains the cloud name, key, and secret required for secure uploads.
