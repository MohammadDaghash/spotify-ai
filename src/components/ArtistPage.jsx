import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import useSpotify from "../hooks/useSpotify";
import { fetchTopSongsBySinger } from "../services/IntegratingAiAPI";

export default function ArtistPage() {
  const [isFlipped, setIsFlipped] = useState(false);
  const { id } = useParams();
  const { getArtist, getArtistAlbums } = useSpotify();
  const [aiSongs, setAiSongs] = useState([]);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [albums, setAlbums] = useState([]);
  const [isFetched,setIsFetched]=useState(false)

  const handleFlipImg = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleFetchMusic = async () => {
    const songs = await fetchTopSongsBySinger(artist.name);
    const arrOfsongs = songs
      .split("\n") 
      .map((line) => line.replace("- ", "").trim());
    setAiSongs(arrOfsongs);
  };

  const handleImgEvent = () => {
    if(aiSongs.length===0 && !isFetched){
        handleFetchMusic()
        setIsFetched(true)
    }
  };

  useEffect(() => {
    async function fetchArtist() {
      try {
        const res = await getArtist(id);
        setArtist(res.data);
        const albumsRes = await getArtistAlbums(id);
        setAlbums(albumsRes);
      } catch (err) {
        console.error("Failed to fetch artist", err);
      } finally {
        setLoading(false);
      }
    }
    fetchArtist();
  }, [id]);

  if (loading) return <div className="text-white p-8">Loading...</div>;
  if (!artist) return null;

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* HEADER */}
      <div
        className="h-100 flex items-end p-8"
        style={{
          background: "linear-gradient(180deg, #b91c1c, #000)",
        }}
      >
        <div
          className="relative w-52 h-52 cursor-pointer"
          style={{ perspective: "1000px" }}
          onClick={handleFlipImg}
        >
          <div
            className="absolute inset-0 transition-transform duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* FRONT (IMAGE) */}
            <div
              className="absolute inset-0"
              style={{ backfaceVisibility: "hidden" }}
            >
              <img
                src={artist.images?.[0]?.url}
                alt={artist.name}
                className="w-full h-full rounded-full object-cover"
                onMouseEnter={handleImgEvent}
              />
            </div>

            {/* BACK */}
            <div
              className="absolute inset-0  flex items-center justify-center
                 bg-gradient-to-br from-zinc-900 to-zinc-700
                 shadow-2xl overflow-hidden"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <div className="text-center space-y-1 text-xs">
                <p>Top 10 songs:</p>
                {aiSongs.length > 0 ? (
                  <ul className="text-left">
                    {aiSongs.map((song,index)=>
                     <li key={index}>• {song}</li>
                    )}
                  </ul>
                ) : (
                  <div>Nothing</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="ml-20">
          <p className="uppercase text-sm text-gray-300">Artist</p>
          <h1 className="text-6xl font-bold">{artist.name}</h1>
          <p className="text-sm text-gray-300 mt-2">
            {artist.followers.total.toLocaleString()} followers
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

        <div className="flex gap-5 overflow-x-auto pb-4">
          {albums.map((album) => (
            <div
              key={album.id}
              className="min-w-[180px] hover:bg-[#1a1a1a] p-3 rounded-lg cursor-pointer"
            >
              <img
                src={album.images?.[0]?.url}
                alt={album.name}
                className="w-full h-44 object-cover rounded-md"
              />

              <p className="mt-2 text-sm font-semibold truncate">
                {album.name}
              </p>

              <p className="text-xs text-gray-400">
                {album.release_date.slice(0, 4)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
