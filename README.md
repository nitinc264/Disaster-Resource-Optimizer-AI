# Disaster Response Resource Optimization Platform

## Project Structure

This project consists of a React Vite frontend and a Node.js Express backend.

```
├── frontend/          # React Vite application
├── backend/           # Node.js Express server
└── package.json       # Root package.json with scripts
```

## Getting Started

### Installation

Install all dependencies:
```bash
npm run install:all
```

Or install separately:
```bash
npm run install:backend
npm run install:frontend
```

### Running the Application

Run both frontend and backend concurrently:
```bash
npm run dev
```

Or run separately:
```bash
npm run frontend  # Runs on http://localhost:5173
npm run backend   # Runs on http://localhost:3000
```

### Development

- **Frontend**: React + Vite (http://localhost:5173)
- **Backend**: Node.js + Express (http://localhost:3000)

## Environment Variables

Backend uses `.env` file for configuration. See `backend/.env` for available options.
