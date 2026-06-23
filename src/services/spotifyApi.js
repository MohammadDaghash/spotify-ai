import axios from "axios";
import { clearSpotifyTokens } from "../utils/localSpotifyHistory.js";

const BASE_URL = "https://api.spotify.com/v1";
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const TOKEN_ENDPOINT =
  import.meta.env.VITE_TOKEN_ENDPOINT ||
  "https://accounts.spotify.com/api/token";
const TOKEN_REFRESH_BUFFER_MS = 60_000;

let refreshPromise = null;

const spotifyApi = axios.create({
  baseURL: BASE_URL,
});

function getSpotifyApiErrorMessage(error) {
  const status = error?.response?.status;

  if (status === 401) {
    return "Your Spotify session expired. Continue with Spotify again to refresh your private data.";
  }

  if (status === 403) {
    return "Spotify blocked this request. If the app is in Development Mode, your Spotify email must be added as a test user.";
  }

  if (status === 429) {
    return "Spotify rate-limited this request. Wait a moment and try again.";
  }

  if (error?.message === "Missing Spotify refresh token") {
    return "Spotify login is incomplete. Continue with Spotify again.";
  }

  return "Spotify API request failed. Try signing in again.";
}

function redirectToSpotifyLoginWithError(error) {
  const message = getSpotifyApiErrorMessage(error);

  clearSpotifyTokens();
  sessionStorage.setItem("spotify_auth_error", message);
  window.location.href = `/login?spotify_error=${encodeURIComponent(message)}`;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("spotify_refresh_token");

  if (!refreshToken || !CLIENT_ID) {
    throw new Error("Missing Spotify refresh token");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const res = await axios.post(TOKEN_ENDPOINT, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const { access_token, expires_in, refresh_token } = res.data;

  if (!access_token) {
    throw new Error("No refreshed access token returned from Spotify");
  }

  localStorage.setItem("spotify_access_token", access_token);
  localStorage.setItem(
    "spotify_token_expires_at",
    String(Date.now() + expires_in * 1000),
  );

  if (refresh_token) {
    localStorage.setItem("spotify_refresh_token", refresh_token);
  }

  return access_token;
}

async function getFreshAccessToken() {
  const token = localStorage.getItem("spotify_access_token");
  const expiresAt = Number(localStorage.getItem("spotify_token_expires_at") || 0);
  const refreshToken = localStorage.getItem("spotify_refresh_token");
  const shouldRefresh =
    refreshToken &&
    (!token || !expiresAt || Date.now() > expiresAt - TOKEN_REFRESH_BUFFER_MS);

  if (!shouldRefresh) {
    return token;
  }

  refreshPromise = refreshPromise || refreshAccessToken().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

spotifyApi.interceptors.request.use(async (config) => {
  let token;

  try {
    token = await getFreshAccessToken();
  } catch (err) {
    redirectToSpotifyLoginWithError(err);
    return Promise.reject(err);
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

spotifyApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config?._retry) {
      try {
        err.config._retry = true;
        const token = await refreshAccessToken();
        err.config.headers.Authorization = `Bearer ${token}`;
        return spotifyApi(err.config);
      } catch {
        redirectToSpotifyLoginWithError(err);
      }
    }

    if (err.response?.status === 401) {
      redirectToSpotifyLoginWithError(err);
    }
    return Promise.reject(err);
  }
);

export default spotifyApi;
