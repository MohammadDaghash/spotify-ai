import axios from "axios";

const BASE_URL = "https://api.spotify.com/v1";

const spotifyApi = axios.create({
  baseURL: BASE_URL,
});

spotifyApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("spotify_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default spotifyApi;