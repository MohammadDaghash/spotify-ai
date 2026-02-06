import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const TOKEN_ENDPOINT = import.meta.env.VITE_TOKEN_ENDPOINT;

function Callback({ setIsLoggedIn }) {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      console.error("Spotify auth error:", error);
      navigate("/login", { replace: true });
      return;
    }

    if (!code) {
      navigate("/login", { replace: true });
      return;
    }

    const codeVerifier = sessionStorage.getItem("spotify_code_verifier");

    if (!codeVerifier) {
      console.error("Missing code verifier");
      navigate("/login", { replace: true });
      return;
    }

    const exchangeToken = async () => {
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

        const { access_token, expires_in } = res.data;

        localStorage.setItem("spotify_access_token", access_token);
        localStorage.setItem(
          "spotify_token_expires_at",
          Date.now() + expires_in * 1000
        );

        sessionStorage.removeItem("spotify_code_verifier");

        setIsLoggedIn(true);
      } catch (err) {
        console.error("Token exchange failed", err);
        navigate("/login", { replace: true });
      }
    };

    exchangeToken();
  }, [navigate, setIsLoggedIn]);

  return <div>Logging you in…</div>;
}

export default Callback;
