// src/components/ArtistPage.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";
import AlbumCard from "./AlbumCard.jsx";

export default function ArtistPage() {
  const { id } = useParams();
  const { getArtist, getArtistAlbums } = useSpotifyContext();

  const [artist, setArtist] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const [artistRes, albumsRes] = await Promise.all([
          getArtist(id),
          getArtistAlbums(id),
        ]);

        // Support either (axios response) or (raw data) from context
        const artistData = artistRes?.data ?? artistRes;
        const albumsData = albumsRes?.data?.items ?? albumsRes; // also supports axios shape

        if (!cancelled) {
          setArtist(artistData || null);
          setAlbums(Array.isArray(albumsData) ? albumsData : []);
        }
      } catch (err) {
        console.error("Failed to fetch artist", err);
        if (!cancelled) {
          setArtist(null);
          setAlbums([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, getArtist, getArtistAlbums]);

  if (loading) return <div className="text-white p-8">Loading...</div>;
  if (!artist) return <div className="text-white p-8">Artist not found.</div>;

  const artistImg = artist.images?.[0]?.url;

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* HEADER */}
      <div
        className="h-100 flex items-end p-8"
        style={{ background: "linear-gradient(180deg, #b91c1c, #000)" }}
      >
        {artistImg ? (
          <img
            src={artistImg}
            alt={artist.name}
            className="w-52 h-52 rounded-full object-cover shadow-xl"
            draggable={false}
          />
        ) : (
          <div className="w-52 h-52 rounded-full bg-zinc-800 shadow-xl flex items-center justify-center text-zinc-300">
            No image
          </div>
        )}

        <div className="ml-20">
          <p className="uppercase text-sm text-gray-300">Artist</p>
          <h1 className="text-6xl font-bold">{artist.name}</h1>
          <p className="text-sm text-gray-300 mt-2">
            {(artist.followers?.total ?? 0).toLocaleString()} followers
          </p>
        </div>
      </div>

      {/* ALBUMS SECTION */}
      <div className="px-8 mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">More by {artist.name}</h2>
          <span className="text-sm text-gray-400 hover:underline cursor-pointer">
            See discography
          </span>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-6">
          {albums.length ? (
            albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                artistName={artist.name}
              />
            ))
          ) : (
            <div className="text-sm text-gray-400">No albums found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
