// Aegis AI/client/src/App.jsx

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import your page components
import VolunteerPage from './pages/VolunteerPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route for the volunteer PWA */}
        <Route path="/" element={<VolunteerPage />} />
        
        {/* Route for your manager dashboard */}
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

// THIS IS THE CRITICAL LINE THAT FIXES THE ERROR
export default App;