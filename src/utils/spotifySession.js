export function hasSpotifyAccessToken() {
  if (typeof localStorage === "undefined") return false;

  return Boolean(
    localStorage.getItem("spotify_access_token") ||
      localStorage.getItem("access_token"),
  );
}
