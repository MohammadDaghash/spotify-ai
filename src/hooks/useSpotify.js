import { useEffect, useState } from "react";
import spotifyApi from "../services/spotifyApi";

export default function useSpotify() {
  const [isName, setIsName] = useState("");
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  const getUserProfile = async () => {
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
  };

  const getTopTracks = async () => {
    const topTracksRes = await spotifyApi.get("/me/top/tracks?limit=10");
    setTracks(topTracksRes.data.items);
  };

  const getUserPlayList = async () => {
    const res = await spotifyApi.get("/me/playlists?limit=20");
    setPlaylists(res.data);
  };

  const searchArtist= async (artistName)=>{
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
  }

  const getArtist = async (id)=>{
    const res= await spotifyApi.get(`/artists/${id}`)
    return res
  }
  const getArtistAlbums = async (id) => {
  const res = await spotifyApi.get(
    `/artists/${id}/albums?include_groups=album,single&limit=20`
  );
  return res.data.items;
};

const getFollowedArtists=async ()=>{
  const res= await spotifyApi.get("/me/following?type=artist&limit=20")
  return res
}

  useEffect(() => {
    getUserProfile().finally(() => setLoading(false));
    getTopTracks().finally(() => setLoading(false));
    getUserPlayList().finally(() => setLoading(false));
  }, []);

  return { tracks, loading, isName, playlists,searchArtist ,getArtist,getArtistAlbums,getFollowedArtists};
}
