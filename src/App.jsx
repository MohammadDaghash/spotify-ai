// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Callback from "./pages/Callback.jsx";
import ArtistPage from "./components/ArtistPage.jsx";

export default function App() {
  return (
    <Routes>
      {/* Always show Dashboard in mock mode */}
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Keep these routes for when Spotify auth is available again */}
      <Route path="/login" element={<Login />} />
      <Route path="/callback" element={<Callback />} />

      {/* Artist page */}
      <Route path="/artist/:id" element={<ArtistPage />} />

      {/* Anything else -> home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
