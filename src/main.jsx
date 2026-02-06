// src/main.jsx  (update)
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { SpotifyProvider } from "./context/SpotifyContext.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <SpotifyProvider>
      <App />
    </SpotifyProvider>
  </BrowserRouter>
);
