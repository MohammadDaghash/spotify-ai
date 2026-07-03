import { useContext } from "react";
import { SpotifyContext } from "./spotifyContextValue.js";

export function useSpotifyContext() {
  const ctx = useContext(SpotifyContext);
  if (!ctx) {
    throw new Error("useSpotifyContext must be used inside SpotifyProvider");
  }
  return ctx;
}
