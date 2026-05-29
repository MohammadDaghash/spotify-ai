// src/pages/Dashboard.jsx
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Header from "../components/layout/Header.jsx";
import Section from "../components/layout/Section.jsx";
import TrackCard from "../components/cards/TrackCard.jsx";
import { useMemo, useState } from "react";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";
import { getRankedRecommendations } from "../utils/recommendationEngine.js";

import {
  monthlyTopSongs,
  monthlyTopArtists,
  monthlyTopAlbums,
  libraryArtists,
  demoUserProfile,
  candidateTracks,
} from "../data/demoMusicData.js";

function StatCard({ title, value, subtitle }) {
  return (
    <div className="bg-[#181818] rounded-lg p-4">
      <p className="text-sm text-gray-400">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function RankingTable({ title, rows, columns }) {
  return (
    <div className="bg-[#181818] rounded-lg p-4">
      <h2 className="text-lg font-bold mb-4">{title}</h2>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={`${title}-${row.rank}-${row.trackName || row.artistName || row.albumName}`}
            className="grid grid-cols-[40px_1fr_auto] gap-3 items-center border-b border-white/5 pb-3"
          >
            <span className="text-gray-400">#{row.rank}</span>

            <div>
              <p className="font-semibold">
                {row.trackName || row.artistName || row.albumName}
              </p>
              <p className="text-xs text-gray-400">
                {columns
                  .map((col) => row[col])
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </div>

            <span className="text-sm font-bold">{row.streams} streams</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const { tracks = [], playlists = [], loading = false } = useSpotifyContext();

  const totalStreams = monthlyTopSongs.reduce(
    (sum, song) => sum + song.streams,
    0,
  );
  const totalMinutes = monthlyTopSongs.reduce(
    (sum, song) => sum + song.minutesPlayed,
    0,
  );

  const [ignoredSongs, setIgnoredSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);

  const rankedRecommendations = useMemo(() => {
    return getRankedRecommendations(candidateTracks, demoUserProfile)
      .filter((track) => !ignoredSongs.includes(track.trackName))
      .filter((track) => !likedSongs.includes(track.trackName));
  }, [ignoredSongs, likedSongs]);

  return (
    <div className="h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar playlists={playlists} />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="p-6 text-white overflow-y-auto h-full">
            <Header />

            <div className="mb-6 text-sm opacity-70">
              {loading
                ? "Loading Spotify data…"
                : "Demo analytics mode — using local Spotify-style data"}
            </div>

            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Streams analyzed"
                value={totalStreams}
                subtitle="Demo January dataset"
              />
              <StatCard
                title="Minutes played"
                value={totalMinutes}
                subtitle="Listening-time signal"
              />
              <StatCard
                title="Artists in library"
                value={libraryArtists.length}
                subtitle="Used for artist affinity"
              />
              <StatCard
                title="Recommendation model"
                value="V1"
                subtitle="Content-based direction"
              />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
              <RankingTable
                title="Top Songs — January 2025"
                rows={monthlyTopSongs}
                columns={["artistName", "albumName"]}
              />

              <RankingTable
                title="Top Artists — January 2025"
                rows={monthlyTopArtists}
                columns={["songsInLibrary"]}
              />

              <RankingTable
                title="Top Albums — January 2025"
                rows={monthlyTopAlbums}
                columns={["artistName"]}
              />
            </section>

            <Section title="Recommended songs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rankedRecommendations.map((rec) => (
                  <div
                    key={`${rec.trackName}-${rec.artistName}`}
                    className="bg-[#181818] rounded-lg p-4 hover:bg-[#252525] transition"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <h3 className="font-bold">{rec.trackName}</h3>
                        <p className="text-sm text-gray-400">
                          {rec.artistName}
                        </p>
                      </div>

                      <span className="text-sm font-bold">
                        {(rec.score * 100).toFixed(0)}%
                      </span>
                    </div>

                    <p className="text-sm text-gray-300 mt-3">{rec.reason}</p>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() =>
                          setLikedSongs((prev) => [...prev, rec.trackName])
                        }
                        className="bg-white text-black text-sm font-semibold px-3 py-1.5 rounded-full"
                      >
                        Add to Library
                      </button>

                      <button
                        onClick={() =>
                          setIgnoredSongs((prev) => [...prev, rec.trackName])
                        }
                        className="bg-[#2a2a2a] text-white text-sm px-3 py-1.5 rounded-full"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Original Spotify API tracks">
              {tracks.length === 0 ? (
                <div className="text-sm opacity-70">
                  No live Spotify tracks available yet.
                </div>
              ) : (
                tracks.map((t) => (
                  <TrackCard
                    key={t.id}
                    title={t.name}
                    artist={(t.artists || []).map((a) => a.name).join(", ")}
                    image={t.album?.images?.[0]?.url || ""}
                  />
                ))
              )}
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
