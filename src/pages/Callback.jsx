import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getSpotifyRedirectUri } from "../services/spotifyAuth.js";

const env = import.meta.env || {};
const CLIENT_ID = env.VITE_SPOTIFY_CLIENT_ID;
const TOKEN_ENDPOINT =
  env.VITE_TOKEN_ENDPOINT ||
  "https://accounts.spotify.com/api/token";

function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function exchangeToken() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");

      if (error || !code) {
        navigate("/login", { replace: true });
        return;
      }

      const codeVerifier = sessionStorage.getItem("spotify_code_verifier");
      const redirectUri =
        sessionStorage.getItem("spotify_redirect_uri") ||
        getSpotifyRedirectUri();

      if (!codeVerifier || !redirectUri || !CLIENT_ID) {
        console.error("Missing Spotify callback configuration");
        navigate("/login", { replace: true });
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

        if (!access_token) {
          throw new Error("No access token returned from Spotify");
        }

        localStorage.setItem("spotify_access_token", access_token);
        localStorage.setItem(
          "spotify_token_expires_at",
          String(Date.now() + expires_in * 1000),
        );

        if (refresh_token) {
          localStorage.setItem("spotify_refresh_token", refresh_token);
        }

        sessionStorage.removeItem("spotify_code_verifier");
        sessionStorage.removeItem("spotify_redirect_uri");

        navigate("/dashboard", { replace: true });
      } catch (err) {
        console.error("Token exchange failed", err);
        navigate("/login", { replace: true });
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
