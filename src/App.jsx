import React, { useState,useEffect} from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Callback from "./pages/Callback.jsx";
import ArtistPage from "./components/ArtistPage.jsx";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
  const token = localStorage.getItem("spotify_access_token");
  const expiresAt = localStorage.getItem("spotify_token_expires_at");
  
  if (token && expiresAt && Date.now() < expiresAt) {
    setIsLoggedIn(true);
  } else {
    localStorage.clear();
    setIsLoggedIn(false);
  }

  setAuthChecked(true);
}, []);

  if (!authChecked) {
    return <div>Checking authentication…</div>;
  }
  return (
    <Routes>
      
      <Route path="/" element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" replace />}/>
      <Route
        path="/callback"
        element={<Callback setIsLoggedIn={setIsLoggedIn} />}
      />
      <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        path="/dashboard"
        element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" replace />}
      />
      <Route path="/artist/:id" element={<ArtistPage />} />
    </Routes>
  );
}

export default App;
