// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Callback from "./pages/Callback.jsx";
import ArtistPage from "./components/ArtistPage.jsx";
import Recommendations from "./pages/Recommendations.jsx";
import Model from "./pages/Model.jsx";
import Trip from "./pages/Trip.jsx";

export default function App() {
  return (
    <Routes>
      {/* Main pages */}
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/recommendations" element={<Recommendations />} />
      <Route path="/group" element={<Trip />} />
      <Route path="/trip" element={<Trip />} />
      <Route path="/model" element={<Model />} />

      {/* Spotify auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/callback" element={<Callback />} />

      {/* Artist page */}
      <Route path="/artist/:id" element={<ArtistPage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
