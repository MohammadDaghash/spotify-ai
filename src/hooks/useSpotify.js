import { useCallback, useEffect, useState } from "react";
import spotifyApi from "../services/spotifyApi";

export default function useSpotify() {
  const [isName, setIsName] = useState("");
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  const getUserProfile = useCallback(async () => {
    try {
      const res = await spotifyApi.get("/me");
      setIsName(
        res.data.display_name
          .trim()
          .split(/\s+/)
          .map((word) => word[0].toUpperCase())
          .join("")
      );
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }
  }, []);

  const getTopTracks = useCallback(async () => {
    const topTracksRes = await spotifyApi.get("/me/top/tracks?limit=10");
    setTracks(topTracksRes.data.items);
  }, []);

  const getUserPlayList = useCallback(async () => {
    const res = await spotifyApi.get("/me/playlists?limit=20");
    setPlaylists(res.data);
  }, []);

  const searchArtist = useCallback(async (artistName) => {
    if(!artistName) return

    try {
            const res = await spotifyApi.get(
        `/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`
      );
      const foundArtist = res.data.artists.items[0] || null;

      return foundArtist
    } catch (error) {
      console.log(error)
    }
  }, []);

  const getArtist = useCallback(async (id) => {
    const res= await spotifyApi.get(`/artists/${id}`)
    return res
  }, []);
  const getArtistAlbums = useCallback(async (id) => {
  const res = await spotifyApi.get(
    `/artists/${id}/albums?include_groups=album,single&limit=20`
  );
  return res.data.items;
}, []);

const getFollowedArtists = useCallback(async () => {
  const res= await spotifyApi.get("/me/following?type=artist&limit=20")
  return res
}, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadSpotifyData() {
      await Promise.allSettled([
        getUserProfile(),
        getTopTracks(),
        getUserPlayList(),
      ]);

      if (isCurrent) {
        setLoading(false);
      }
    }

    loadSpotifyData();

    return () => {
      isCurrent = false;
    };
  }, [getTopTracks, getUserPlayList, getUserProfile]);

  return { tracks, loading, isName, playlists,searchArtist ,getArtist,getArtistAlbums,getFollowedArtists};
}
