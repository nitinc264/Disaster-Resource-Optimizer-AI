# AEGIS AI — Disaster Response Resource Optimization Platform

An AI-powered full-stack platform that coordinates disaster response through **SMS triage**, **volunteer management**, **resource allocation**, **route optimization**, and **emergency station dispatch**. Built with React, Node.js, MongoDB, and multiple AI agents (Google Gemini, TensorFlow/Keras).

---

## About the Project

### The Problem

During natural disasters (floods, earthquakes, cyclones), emergency response teams face critical challenges:

- **Information overload** — Thousands of citizen reports pour in via SMS, calls, and social media with no way to prioritize them automatically.
- **Resource misallocation** — Limited supplies (water, medicine, rescue teams) get sent to the wrong places or arrive too late.
- **Coordination gaps** — Volunteers, managers, and emergency stations (fire, police, hospital, rescue) operate in silos with no shared real-time picture.
- **Connectivity loss** — Disaster zones often lose internet, making cloud-only tools useless when they're needed most.

### The Solution

AEGIS AI addresses each of these by combining **AI-powered automation** with a **human verification workflow**:

1. **Citizens** report emergencies by simply texting an SMS or uploading a photo — no app download required.
2. **AI agents** automatically classify the disaster type, assess severity (1–10), detect urgency, and extract location — in seconds, not hours.
3. **Volunteers** verify AI-processed reports on a map-based dashboard, filtering out duplicates and false alarms.
4. **Managers** allocate resources from an inventory system, plan optimized delivery routes, and dispatch alerts to emergency stations.
5. **Emergency stations** (fire, hospital, police, rescue) receive real-time alerts with Socket.IO and can respond immediately.

The entire platform works **offline-first** — field volunteers can continue verifying reports and queueing actions even without internet, and everything syncs automatically when connectivity returns.

### How It Solves Real Problems

| Disaster Challenge                                 | How AEGIS AI Handles It                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Citizen texts "Trapped in basement, water rising!" | Gemini AI classifies as **Rescue / High urgency**, geocodes the address, and creates a prioritized report — all within seconds |
| A photo of a flooded street is uploaded            | Sentinel Agent (TensorFlow model) classifies it as a **flood disaster** and tags it automatically                              |
| 200+ reports come in within an hour                | Oracle Agent scores severity 1–10 so managers see the most critical cases first                                                |
| Rescue team needs the fastest route to 5 locations | Logistics Agent calculates the optimal multi-stop route using OSRM                                                             |
| Internet goes down in the disaster zone            | The PWA continues working offline via IndexedDB; actions sync when connectivity returns                                        |
| Affected citizens speak Hindi or Marathi           | The interface supports **English, Hindi, and Marathi** out of the box                                                          |

### Data Flow — End to End

```
┌──────────────┐     SMS / Photo / Voice      ┌──────────────────────┐
│   Citizens   │ ──────────────────────────►   │   Twilio / Upload    │
└──────────────┘                               └──────────┬───────────┘
                                                          │
                                                          ▼
                                               ┌──────────────────────┐
                                               │   Gemini AI Triage   │
                                               │  (classify, extract  │
                                               │   urgency, location) │
                                               └──────────┬───────────┘
                                                          │
                            ┌─────────────────────────────┼─────────────────────────────┐
                            ▼                             ▼                             ▼
                 ┌────────────────────┐       ┌────────────────────┐       ┌────────────────────┐
                 │  Sentinel Agent    │       │   Oracle Agent     │       │  Logistics Agent   │
                 │  (image classify)  │       │  (severity 1-10)   │       │  (route optimize)  │
                 └────────┬───────────┘       └────────┬───────────┘       └────────┬───────────┘
                          │                            │                            │
                          └─────────────────┬──────────┘────────────────────────────┘
                                            ▼
                                  ┌──────────────────┐
                                  │     MongoDB      │
                                  │  (all reports &  │
                                  │   enriched data) │
                                  └────────┬─────────┘
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                     ┌──────────────┐ ┌──────────┐ ┌─────────────────┐
                     │  Volunteer   │ │ Manager  │ │   Emergency     │
                     │  Dashboard   │ │Dashboard │ │   Stations      │
                     │  (verify)    │ │(allocate)│ │ (fire/hospital/ │
                     └──────────────┘ └──────────┘ │  police/rescue) │
                                                   └─────────────────┘
```

---

## Table of Contents

- [About the Project](#about-the-project)
- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
  - [1. Clone & Install](#1-clone--install)
  - [2. Backend Environment Variables](#2-backend-environment-variables)
  - [3. Python Agents Setup](#3-python-agents-setup)
  - [4. Station Demo Setup (Optional)](#4-station-demo-setup-optional)
- [Running the Application](#running-the-application)
- [User Roles & Pages](#user-roles--pages)
- [SMS Chatbot Usage](#sms-chatbot-usage)
- [AI Agents](#ai-agents)
- [Emergency Station Demo](#emergency-station-demo)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

AEGIS AI (**A**utomated **E**mergency **G**uidance & **I**ntelligent **S**ystem) helps disaster response teams by automating the full lifecycle from citizen reports to resource dispatch:

```
Citizens report emergencies (SMS / Photo / Voice)
        ↓
   AI Triage (Gemini AI classifies & prioritizes)
        ↓
   Volunteers verify reports on the dashboard
        ↓
   Managers allocate resources & plan optimized routes
        ↓
   Emergency stations (Fire, Hospital, Police, Rescue) receive alerts
```

The platform is designed as an **offline-first PWA** — it continues working in low-connectivity disaster scenarios via IndexedDB and background sync.

### What Makes This Different

- **Multi-agent AI pipeline** — Not a single model, but three specialized agents (Sentinel, Oracle, Logistics) working in tandem, each adding a layer of intelligence.
- **Works without internet** — Built for real disaster conditions where connectivity fails. Volunteers can work offline and sync later.
- **No app install needed for citizens** — Anyone can report via a plain SMS text message.
- **End-to-end automation** — From raw citizen text → AI classification → volunteer verification → resource dispatch → emergency station alert, all orchestrated automatically.
- **Role-based access** — Managers, volunteers, and the public each see exactly what they need.

---

## Key Features

| Feature                 | Description                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| **SMS Triage**          | Citizens text emergencies to a Twilio number; Gemini AI classifies need type, urgency, and location |
| **Photo Reports**       | Upload disaster photos; a TensorFlow/Keras model (Sentinel Agent) classifies the disaster type      |
| **AI Severity Scoring** | Oracle Agent uses Gemini to assign severity scores to incoming reports                              |
| **Route Optimization**  | Logistics Agent calculates optimal delivery routes via OSRM                                         |
| **Emergency Dispatch**  | Automatic alerts sent to fire, hospital, police, and rescue station servers                         |
| **Volunteer Dashboard** | Task assignment, report verification, route guidance on an interactive Leaflet map                  |
| **Manager Dashboard**   | Real-time analytics, resource inventory, shelter management, mission planning                       |
| **Offline-First PWA**   | Works without internet; syncs when connectivity is restored (Dexie/IndexedDB)                       |
| **Multi-Language**      | English, Hindi, and Marathi (i18next)                                                               |
| **Missing Persons**     | Family reunification registry                                                                       |
| **Shelter Management**  | Evacuation center capacity tracking                                                                 |
| **Weather Integration** | Live weather data from OpenWeatherMap for situational awareness                                     |
| **Accessibility**       | Configurable accessibility settings                                                                 |
| **QR Code Support**     | Generate/scan QR codes for resource tracking                                                        |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                        │
│   Dashboard · Volunteer · Resources · Shelters · Emergency Stations    │
│   PWA with IndexedDB (Dexie) for offline support                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │  REST API (port 5173 → proxy → 3000)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js / Express)                        │
│   Routes · Controllers · Services · Middleware · Auth (PIN-based)      │
│                                                                        │
│   ┌─────────────────── AI AGENTS ───────────────────┐                  │
│   │  Sentinel (Python/TF)  │  Oracle (Node/Gemini)  │                  │
│   │  Image classification  │  Severity scoring      │                  │
│   │                        │                        │                  │
│   │  Logistics (Python)    │                        │                  │
│   │  OSRM route optimizer  │                        │                  │
│   └────────────────────────┴────────────────────────┘                  │
└──────────┬──────────────┬──────────────┬──────────────┬────────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
      MongoDB        Cloudinary       Twilio     OpenWeatherMap
      (Database)     (Images)         (SMS)      (Weather)
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               EMERGENCY STATION DEMO SERVERS (Socket.IO)               │
│   Fire :4001  ·  Hospital :4002  ·  Police :4003  ·  Rescue :4004     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer            | Technologies                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**     | React 19, Vite 7, React Router 7, TanStack React Query, Leaflet, Dexie (IndexedDB), i18next, Lucide icons, vite-plugin-pwa |
| **Backend**      | Node.js (ES Modules), Express 4, Mongoose 8, express-session + connect-mongo, Multer, express-validator                    |
| **AI / ML**      | Google Gemini AI (`@google/generative-ai`), OpenAI SDK, TensorFlow/Keras (Python)                                          |
| **Integrations** | Twilio (SMS), Cloudinary (image hosting), OpenWeatherMap, OSRM (routing)                                                   |
| **Station Demo** | Express, Socket.IO, Mongoose                                                                                               |
| **Dev Tools**    | Nodemon, Concurrently, ESLint, cross-env                                                                                   |

---

## Project Structure

```
├── package.json                  # Root — workspace scripts (dev, build, install:all)
├── backend/
│   ├── server.js                 # Express server entry point
│   ├── config/                   # DB connection, env settings, constants
│   ├── controllers/              # Route handlers (auth, SMS, resources, etc.)
│   ├── middleware/                # Auth, error handler, HTTP logger
│   ├── models/                   # Mongoose schemas + Keras model file
│   ├── routes/                   # API route definitions
│   ├── services/                 # Business logic (Gemini, Cloudinary, weather, routing)
│   ├── agents/                   # AI agents (Python & Node.js)
│   │   ├── sentinel_agent.py     # Image classification (TensorFlow/Keras)
│   │   ├── oracle_agent.js       # Severity scoring (Gemini AI)
│   │   ├── logistics_agent.py    # Route optimization (OSRM)
│   │   └── requirements.txt      # Python dependencies
│   ├── scripts/                  # Utility scripts (seed, clear DB, simulate SMS)
│   └── utils/                    # Helpers (logger, text parser, API response)
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Root component with routing
│   │   ├── pages/                # DashboardPage, VolunteerPage, ResourcesPage, etc.
│   │   ├── components/           # 26 reusable components (Map, Navbar, ReportsList, etc.)
│   │   ├── contexts/             # AuthContext, OfflineContext, VolunteerRouteContext
│   │   ├── services/             # API clients, IndexedDB setup, verification service
│   │   └── i18n/                 # Translations (en, hi, mr)
│   └── package.json
└── station-demo/
    ├── server.js                 # Express + Socket.IO station server
    ├── public/index.html         # Station dashboard UI
    ├── config/                   # Station type/port configuration
    ├── routes/                   # Alert & resource API routes
    └── scripts/                  # Init, register, clear, test scripts
```

---

## Prerequisites

Before you begin, make sure you have:

| Requirement | Version | Notes                                                                           |
| ----------- | ------- | ------------------------------------------------------------------------------- |
| **Node.js** | v18+    | [Download](https://nodejs.org/) — v18 LTS or newer recommended                  |
| **npm**     | v9+     | Comes with Node.js                                                              |
| **MongoDB** | v6+     | [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier) **or** local MongoDB |
| **Python**  | 3.9+    | Only needed if running Sentinel/Logistics agents                                |
| **Git**     | Any     | To clone the repository                                                         |

### External API Accounts (sign up for free tiers)

| Service              | Why You Need It              | Sign Up                                                  |
| -------------------- | ---------------------------- | -------------------------------------------------------- |
| **Google Gemini AI** | AI triage & severity scoring | [Google AI Studio](https://aistudio.google.com/apikey)   |
| **Twilio**           | SMS sending/receiving        | [Twilio Console](https://www.twilio.com/try-twilio)      |
| **Cloudinary**       | Photo upload storage         | [Cloudinary](https://cloudinary.com/users/register_free) |
| **OpenWeatherMap**   | Weather data                 | [OpenWeatherMap](https://openweathermap.org/api)         |

> **Tip:** Gemini and MongoDB are the only hard requirements to run the core platform. Twilio is needed for SMS features, Cloudinary for photo uploads, and OpenWeatherMap for weather data. The platform runs fine without them — those features will simply be unavailable.

---

## Installation & Setup

### 1. Clone & Install

```bash
# Clone the repository
git clone <repository-url>
cd "Disaster Response Resource Optimization Platform"

# Install all dependencies (root + backend + frontend)
npm run install:all
```

This runs `npm install` in the root, `backend/`, and `frontend/` directories.

### 2. Backend Environment Variables

Create a `.env` file inside the `backend/` folder:

```bash
cd backend
cp .env.example .env   # If .env.example exists, or create manually
```

Add the following to `backend/.env`:

```env
# ── Required ──────────────────────────────────────────────
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/DisasterResponseDB
SESSION_SECRET=any-long-random-string
GEMINI_API_KEY=your-gemini-api-key

# ── SMS (required for SMS features) ──────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token

# ── Photo Uploads (required for photo reports) ───────────
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
# Or use individual values:
# CLOUDINARY_CLOUD_NAME=your-cloud-name
# CLOUDINARY_API_KEY=your-api-key
# CLOUDINARY_API_SECRET=your-api-secret

# ── Weather (required for weather widget) ─────────────────
OPENWEATHER_API_KEY=your-openweathermap-key

# ── Optional ──────────────────────────────────────────────
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
OPENAI_API_KEY=your-openai-key
```

> **Local MongoDB users:** If using a local MongoDB instance instead of Atlas, set:
>
> ```env
> MONGO_URI=mongodb://localhost:27017/DisasterResponseDB
> ```

### 3. Python Agents Setup

The Sentinel Agent (image classification) and Logistics Agent (route optimization) are written in Python. Skip this step if you don't need them.

```bash
cd backend/agents

# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

> **Note:** TensorFlow can be large (~500 MB). The `disaster_model.keras` model file is already included in `backend/models/`.

### 4. Station Demo Setup (Optional)

The station demo simulates emergency stations receiving alerts from the platform.

```bash
cd station-demo
npm install
```

Create `station-demo/.env` (optional — defaults work for local development):

```env
MAIN_PLATFORM_URL=http://localhost:3000
```

---

## Running the Application

### Quick Start — Run Everything

From the project root:

```bash
npm run dev
```

This starts both the **backend** (port 3000) and **frontend** (port 5173) concurrently.

| Service     | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:5173 |
| Backend API | http://localhost:3000 |

### Run Services Individually

```bash
# Backend only
cd backend
npm run dev

# Frontend only
cd frontend
npm run dev

# Station demo (all 4 stations)
cd station-demo
npm run start:all

# Individual station
cd station-demo
npm run start:fire       # Port 4001
npm run start:hospital   # Port 4002
npm run start:police     # Port 4003
npm run start:rescue     # Port 4004
```

### Run AI Agents

Agents are started automatically by the backend server when it boots up. To run them manually:

```bash
cd backend

# Oracle Agent (Node.js — severity scoring)
npm run agent:oracle

# Sentinel Agent (Python — image classification)
npm run agent:sentinel

# Logistics Agent (Python — route optimization)
npm run agent:logistics
```

### Useful Backend Scripts

```bash
cd backend

npm run sms:simulate      # Simulate incoming SMS messages
npm run db:clear          # Clear the database (requires --confirm flag)
npm run monitor           # Monitor real-time data changes
```

---

## User Roles & Pages

The platform has three access levels:

| Role          | Access                                                                      | How to Login                    |
| ------------- | --------------------------------------------------------------------------- | ------------------------------- |
| **Manager**   | Full access — dashboard, resources, shelters, emergency stations, analytics | Select "Manager" → enter PIN    |
| **Volunteer** | Task list, report verification, route guidance, messaging                   | Select "Volunteer" → enter PIN  |
| **Public**    | Read-only public dashboard                                                  | Select "Public" (no PIN needed) |

### Application Pages

| Route                 | Page               | Role                | Description                                 |
| --------------------- | ------------------ | ------------------- | ------------------------------------------- |
| `/dashboard`          | Dashboard          | Manager / Volunteer | Main dashboard with map, reports, analytics |
| `/tasks`              | Volunteer Tasks    | Volunteer           | Task verification list with route guidance  |
| `/resources`          | Resources          | Manager only        | Resource inventory, station management      |
| `/add-shelter`        | Add Shelter        | Manager only        | Register evacuation shelters                |
| `/emergency-stations` | Emergency Stations | Manager only        | Manage & dispatch to emergency stations     |

> **Default manager credentials** are initialized on first server start. Check the console output or `authController.js` for the default PIN.

---

## SMS Chatbot Usage

### How It Works

1. A citizen texts an emergency to the configured **Twilio phone number**
2. Twilio forwards the message to the backend webhook (`/api/sms`)
3. **Gemini AI** analyzes and extracts: need type, location, details, urgency
4. The report is stored in **MongoDB** and appears on the dashboard
5. A **confirmation SMS** is sent back to the citizen

### Example Messages

```
Help! We need water and medicine at 123 Main Street. My grandmother is sick.
→ Type: Medical | Urgency: High | Location: 123 Main Street

Trapped in basement at 789 Pine St. Water rising fast!
→ Type: Rescue | Urgency: High | Location: 789 Pine St

Need food for 3 families near Central Park
→ Type: Food | Urgency: Medium | Location: Central Park
```

### Testing SMS Locally

You can simulate SMS messages without Twilio using the built-in scripts:

```bash
cd backend
npm run sms:simulate
```

For real SMS testing, expose your local server with [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
```

Then set your Twilio webhook URL to `https://<ngrok-id>.ngrok.io/api/sms`.

---

## AI Agents

The platform runs three AI agents that process reports in the background:

| Agent         | Language | Purpose                       | How It Works                                                                                                 |
| ------------- | -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Sentinel**  | Python   | Disaster image classification | Polls MongoDB for new photo reports → runs TensorFlow/Keras model → writes classification back to the report |
| **Oracle**    | Node.js  | Severity scoring              | Polls for new reports → sends details to Gemini AI → writes severity score (1–10) back to the report         |
| **Logistics** | Python   | Route optimization            | Polls for dispatched missions → calculates optimal routes via OSRM API → writes route data back              |

Agents are **automatically started** when the backend server boots. They can also be run independently (see [Run AI Agents](#run-ai-agents)).

---

## Emergency Station Demo

The `station-demo/` directory contains simulated emergency station servers. Each station has its own:

- Express server with Socket.IO for real-time alerts
- Web dashboard showing incoming alerts with sound notifications
- MongoDB database for alert persistence
- Resource tracking endpoints

```bash
cd station-demo

# Initialize station databases
npm run db:init

# Register stations with the main platform
npm run setup

# Start all four stations
npm run start:all

# Test sending an alert to a specific station
npm run test:fire
npm run test:hospital
```

| Station  | Port | Dashboard             |
| -------- | ---- | --------------------- |
| Fire     | 4001 | http://localhost:4001 |
| Hospital | 4002 | http://localhost:4002 |
| Police   | 4003 | http://localhost:4003 |
| Rescue   | 4004 | http://localhost:4004 |

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable              | Required    | Description                   | Default                                        |
| --------------------- | ----------- | ----------------------------- | ---------------------------------------------- |
| `MONGO_URI`           | Yes         | MongoDB connection string     | `mongodb://localhost:27017/DisasterResponseDB` |
| `SESSION_SECRET`      | Yes         | Express session secret key    | —                                              |
| `GEMINI_API_KEY`      | Yes         | Google Gemini AI API key      | —                                              |
| `TWILIO_ACCOUNT_SID`  | For SMS     | Twilio Account SID            | —                                              |
| `TWILIO_AUTH_TOKEN`   | For SMS     | Twilio Auth Token             | —                                              |
| `CLOUDINARY_URL`      | For photos  | Cloudinary connection URL     | —                                              |
| `OPENWEATHER_API_KEY` | For weather | OpenWeatherMap API key        | —                                              |
| `OPENAI_API_KEY`      | No          | OpenAI API key (optional)     | —                                              |
| `NODE_ENV`            | No          | `development` or `production` | `development`                                  |
| `PORT`                | No          | Backend server port           | `3000`                                         |
| `ALLOWED_ORIGINS`     | No          | Comma-separated CORS origins  | `http://localhost:5173,http://localhost:3000`  |

### Python Agents (read from `backend/.env` via `python-dotenv`)

| Variable                 | Description                         | Default                                        |
| ------------------------ | ----------------------------------- | ---------------------------------------------- |
| `MONGO_URI`              | MongoDB connection string           | `mongodb://localhost:27017/DisasterResponseDB` |
| `SENTINEL_POLL_INTERVAL` | Sentinel polling interval (seconds) | `2`                                            |
| `OSRM_BASE_URL`          | OSRM routing server URL             | `https://router.project-osrm.org`              |

### Station Demo (`station-demo/.env`)

| Variable             | Description                  | Default                                                |
| -------------------- | ---------------------------- | ------------------------------------------------------ |
| `MAIN_PLATFORM_URL`  | Main platform backend URL    | `http://localhost:3000`                                |
| `MONGO_URI_FIRE`     | Fire station MongoDB URI     | `mongodb://localhost:27017/emergency_station_fire`     |
| `MONGO_URI_HOSPITAL` | Hospital station MongoDB URI | `mongodb://localhost:27017/emergency_station_hospital` |
| `MONGO_URI_POLICE`   | Police station MongoDB URI   | `mongodb://localhost:27017/emergency_station_police`   |
| `MONGO_URI_RESCUE`   | Rescue station MongoDB URI   | `mongodb://localhost:27017/emergency_station_rescue`   |

### Frontend (`frontend/.env`)

| Variable            | Description     | Default                             |
| ------------------- | --------------- | ----------------------------------- |
| `VITE_API_BASE_URL` | Backend API URL | `/api` (proxied by Vite dev server) |

---

## Troubleshooting

| Problem                       | Solution                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **MongoDB connection error**  | Check `MONGO_URI` is correct. For Atlas, whitelist your IP in Network Access. For local, ensure `mongod` is running. |
| **Gemini API errors**         | Verify `GEMINI_API_KEY` is set and valid. Check [quota limits](https://aistudio.google.com/).                        |
| **SMS not being received**    | Ensure ngrok is running, and the Twilio webhook URL matches `https://<ngrok-id>.ngrok.io/api/sms`.                   |
| **Python agents won't start** | Activate the virtual environment first. Run `pip install -r requirements.txt`. Check Python 3.9+.                    |
| **TensorFlow import errors**  | Ensure you have a compatible Python version. Try `pip install tensorflow --upgrade`.                                 |
| **Frontend not loading**      | Run `npm install` in `frontend/`. Check that the backend is running (Vite proxies `/api` to port 3000).              |
| **Session/auth issues**       | Set `SESSION_SECRET` in `.env`. Clear browser cookies if switching roles.                                            |
| **Cloudinary upload fails**   | Verify `CLOUDINARY_URL` format: `cloudinary://key:secret@cloud_name`.                                                |
| **Port already in use**       | Kill the existing process or change the port in `.env`.                                                              |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

**Built for disaster response teams worldwide — by Omkar Kale**
