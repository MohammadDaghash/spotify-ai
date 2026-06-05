import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const TOKEN_ENDPOINT =
  import.meta.env.VITE_TOKEN_ENDPOINT ||
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

      if (!codeVerifier) {
        console.error("Missing code verifier");
        navigate("/login", { replace: true });
        return;
      }

      try {
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
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
