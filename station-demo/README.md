# Emergency Station Demo System

This directory contains demo emergency station websites that can receive alerts from the main Disaster Response Platform.

## Overview

The system includes demo stations for:

- 🚒 **Fire Station** (Port 4001)
- 🏥 **Hospital** (Port 4002)
- 🚔 **Police Station** (Port 4003)
- 🚑 **Rescue Team** (Port 4004)

Each station has its **own separate database** and communicates with the main platform only via API.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN DISASTER PLATFORM                        │
│                     (localhost:5000)                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  When disaster is verified/detected:                     │   │
│  │  1. Determine emergency type (fire, medical, etc.)       │   │
│  │  2. Find nearest appropriate station(s)                  │   │
│  │  3. Send alert via HTTP POST to station API              │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTP POST /api/alerts/receive
                           │
     ┌─────────────────────┼─────────────────────┐
     │                     │                     │
     ▼                     ▼                     ▼
┌─────────┐         ┌─────────────┐        ┌─────────────┐
│  🚒     │         │    🏥       │        │    🚔       │
│  Fire   │         │  Hospital   │        │   Police    │
│ Station │         │             │        │  Station    │
│ :4001   │         │   :4002     │        │   :4003     │
│         │         │             │        │             │
│ Own DB  │         │   Own DB    │        │   Own DB    │
└─────────┘         └─────────────┘        └─────────────┘
```

## Setup

### 1. Install Dependencies

```bash
cd station-demo
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Each station uses its own MongoDB database. The default configuration uses:

- `mongodb://localhost:27017/emergency_station_fire`
- `mongodb://localhost:27017/emergency_station_hospital`
- `mongodb://localhost:27017/emergency_station_police`
- `mongodb://localhost:27017/emergency_station_rescue`

### 3. Register Stations with Main Platform

Make sure the main platform is running, then:

```bash
npm run setup
```

This will register all demo stations with the main disaster response platform.

### 4. Start Station Servers

Start all stations at once:

```bash
npm run start:all
```

Or start individually:

```bash
npm run start:fire      # Port 4001
npm run start:hospital  # Port 4002
npm run start:police    # Port 4003
npm run start:rescue    # Port 4004
```

For development with auto-reload:

```bash
npm run dev:fire
npm run dev:hospital
npm run dev:police
npm run dev:rescue
```

## Station Dashboards

Once running, access the station dashboards at:

- 🚒 Fire Station: http://localhost:4001
- 🏥 Hospital: http://localhost:4002
- 🚔 Police Station: http://localhost:4003
- 🚑 Rescue Team: http://localhost:4004

### Dashboard Features

- **Real-time alerts** via WebSocket
- **Alert sound notifications** (can be toggled)
- **Map view** showing alert locations
- **Alert management**: Acknowledge, Dispatch, Resolve
- **Statistics**: Active alerts, critical alerts, etc.

## API Endpoints

Each station exposes the following API:

### Health Check

```
GET /api/health
```

### Receive Alert (from main platform)

```
POST /api/alerts/receive
Headers:
  X-API-Key: <station-api-key>
  X-Alert-Priority: critical|normal

Body:
{
  "alertId": "uuid",
  "emergencyType": "fire|flood|medical|...",
  "severity": 1-10,
  "location": { "lat": number, "lng": number },
  "title": "Alert title",
  "description": "Description",
  "needs": ["Water", "Medical", ...],
  "timestamp": "ISO-8601"
}
```

### List Alerts

```
GET /api/alerts
GET /api/alerts?status=received|acknowledged|dispatched|resolved
```

### Get Alert

```
GET /api/alerts/:alertId
```

### Acknowledge Alert

```
PUT /api/alerts/:alertId/acknowledge
```

### Update Alert Status

```
PUT /api/alerts/:alertId/status
Body: { "status": "acknowledged|dispatched|en_route|on_scene|resolved" }
```

### Dispatch Unit

```
POST /api/alerts/:alertId/dispatch
Body: { "unitId": "unit-123", "unitName": "Engine 1" }
```

### Get Statistics

```
GET /api/stats
```

## How Alerts Work

1. **Disaster Detected**: When the main platform detects/verifies a disaster (via AI analysis or manual verification)

2. **Emergency Type Determined**: The system analyzes the report to determine the type:

   - Fire/smoke → Fire Station
   - Medical emergency → Hospital
   - Traffic accident → Police + Hospital
   - Flood/earthquake → Rescue Team

3. **Find Nearest Station**: Using the disaster location, find the nearest appropriate station(s)

4. **Send Alert**: HTTP POST to each station's `/api/alerts/receive` endpoint

5. **Station Receives**:

   - Alert saved to station's own database
   - WebSocket broadcasts to connected dashboards
   - Alert sound plays
   - Browser notification shown

6. **Station Responds**:
   - Staff acknowledges alert
   - Dispatches units
   - Updates status as response progresses
   - Marks resolved when complete

## Customizing Stations

### Adding New Station Types

1. Add configuration in `config/stationConfig.js`
2. Add start script in `package.json`
3. Register with main platform

### Customizing Appearance

Each station type has its own theme color. Modify `config/stationConfig.js`:

```javascript
fire: {
  themeColor: "#f97316", // Orange
  ...
}
```

### Alert Sound

The dashboard uses a built-in alert sound. To customize:

1. Add your audio file to `public/`
2. Update the `alertSound` config or modify `index.html`

## Testing

### Send Test Alert

From the main platform, you can:

1. Go to Emergency Stations management
2. Click "Manual Alert"
3. Fill in alert details
4. Click "Dispatch Alert"

### Direct API Test

```bash
curl -X POST http://localhost:4001/api/alerts/receive \
  -H "Content-Type: application/json" \
  -H "X-API-Key: fire-station-demo-key-2024" \
  -d '{
    "alertId": "test-123",
    "emergencyType": "fire",
    "severity": 8,
    "location": { "lat": 18.52, "lng": 73.85 },
    "title": "TEST: Fire Alert",
    "description": "This is a test alert"
  }'
```

## Troubleshooting

### Station not receiving alerts

1. Check station is registered on main platform
2. Verify API URL and key match
3. Check network connectivity
4. Look at station server logs

### Database connection issues

Ensure MongoDB is running and accessible. Each station needs its own database.

### WebSocket not connecting

Check browser console for errors. Ensure the station server is running.

## Production Deployment

For production:

1. Use secure HTTPS URLs
2. Use strong, unique API keys
3. Set up proper MongoDB instances (possibly separate servers)
4. Configure proper CORS settings
5. Use environment variables for all sensitive data
6. Set up monitoring and logging
