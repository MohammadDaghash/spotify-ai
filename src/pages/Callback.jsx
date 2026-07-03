import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  getSpotifyCallbackErrorMessage,
  getSpotifyRedirectUri,
} from "../services/spotifyAuth.js";
import {
  clearSpotifyTokens,
  enablePrivateSpotifyDataMode,
} from "../utils/localSpotifyHistory.js";

const env = import.meta.env || {};
const CLIENT_ID = env.VITE_SPOTIFY_CLIENT_ID;
const TOKEN_ENDPOINT =
  env.VITE_TOKEN_ENDPOINT ||
  "https://accounts.spotify.com/api/token";

function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    function getSafeReturnPath(value) {
      const fallback = "/dashboard";
      const path = String(value || "").trim();

      if (!path || !path.startsWith("/") || path.startsWith("//")) {
        return fallback;
      }

      return path;
    }

    function failLogin(message) {
      clearSpotifyTokens();
      sessionStorage.setItem("spotify_auth_error", message);
      navigate(`/login?spotify_error=${encodeURIComponent(message)}`, {
        replace: true,
      });
    }

    async function exchangeToken() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");
      const returnedState = params.get("state");

      if (error) {
        failLogin(getSpotifyCallbackErrorMessage({ error }));
        return;
      }

      if (!code) {
        failLogin(getSpotifyCallbackErrorMessage({ missing: "code" }));
        return;
      }

      const codeVerifier = sessionStorage.getItem("spotify_code_verifier");
      const expectedState = sessionStorage.getItem("spotify_auth_state");
      const redirectUri =
        sessionStorage.getItem("spotify_redirect_uri") ||
        getSpotifyRedirectUri();

      if (!expectedState || returnedState !== expectedState) {
        failLogin(getSpotifyCallbackErrorMessage({ missing: "state" }));
        return;
      }

      if (!codeVerifier || !redirectUri || !CLIENT_ID) {
        console.error("Missing Spotify callback configuration");
        failLogin(getSpotifyCallbackErrorMessage({ missing: "config" }));
        return;
      }

      try {
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
          code_verifier: codeVerifier,
        });

        const res = await axios.post(TOKEN_ENDPOINT, body.toString(), {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        const { access_token, expires_in, refresh_token } = res.data;
        const authMode = sessionStorage.getItem("spotify_auth_mode") || "private";
        const returnPath = getSafeReturnPath(
          sessionStorage.getItem("spotify_auth_return_path"),
        );

        if (!access_token) {
          failLogin(getSpotifyCallbackErrorMessage({ missing: "token" }));
          return;
        }

        localStorage.setItem("spotify_access_token", access_token);
        localStorage.setItem(
          "spotify_token_expires_at",
          String(Date.now() + expires_in * 1000),
        );

        if (refresh_token) {
          localStorage.setItem("spotify_refresh_token", refresh_token);
        }

        if (authMode === "private") {
          enablePrivateSpotifyDataMode();
        }

        sessionStorage.removeItem("spotify_code_verifier");
        sessionStorage.removeItem("spotify_redirect_uri");
        sessionStorage.removeItem("spotify_auth_state");
        sessionStorage.removeItem("spotify_auth_mode");
        sessionStorage.removeItem("spotify_auth_return_path");
        sessionStorage.removeItem("spotify_auth_error");

        navigate(returnPath, { replace: true });
      } catch (err) {
        console.error("Token exchange failed", err);
        failLogin(getSpotifyCallbackErrorMessage({ tokenError: err }));
      }
    }

    exchangeToken();
  }, [navigate]);

  return (
    <div className="h-screen bg-black flex items-center justify-center text-white">
      Logging you in…
    </div>
  );
}

export default Callback;
