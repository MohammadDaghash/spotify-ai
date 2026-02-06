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

spotifyApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("spotify_access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default spotifyApi;
