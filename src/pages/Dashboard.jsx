// src/pages/Dashboard.jsx (update - replace useSpotify with context)
import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Header from "../components/layout/Header.jsx";
import Section from "../components/layout/Section.jsx";
import TrackCard from "../components/cards/TrackCard.jsx";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";

function Dashboard() {
  const { tracks, playlists } = useSpotifyContext();

  return (
    <div className="h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1">
        <Sidebar playlists={playlists} />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="p-6 text-white overflow-y-auto h-full">
            <Header />

            <Section title="Recommended for you">
              {tracks.map((t) => (
                <TrackCard
                  key={t.id}
                  title={t.name}
                  artist={t.artists?.map((a) => a.name).join(", ")}
                  image={t.album?.images?.[0]?.url}
                />
              ))}
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
