function GroupPlaylistsSection({
  creatingPlaylistKey,
  displayedTripPlaylists,
  hasDisplayedTripPlaylistTracks,
  runAdminAction,
  createTripPlaylist,
}) {
  if (!displayedTripPlaylists || !hasDisplayedTripPlaylistTracks) return null;

  return (
    <section className="bg-[#181818] rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold">Group playlists</h2>
          <p className="text-sm text-gray-400 mt-1">
            Three playlist strategies for group listening.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(displayedTripPlaylists).map(
          ([playlistKey, playlist]) => (
            <div
              key={playlistKey}
              className="bg-[#121212] rounded-lg p-4 border border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{playlist.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {playlist.description}
                  </p>
                </div>

                <span className="text-sm text-gray-400">
                  {playlist.tracks.length}
                </span>
              </div>

              <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-2">
                {playlist.tracks.slice(0, 8).map((track, index) => (
                  <div
                    key={`${playlistKey}-${track.track_name}-${track.artist_name}`}
                    className="text-sm"
                  >
                    <p className="font-semibold">
                      #{index + 1} {track.track_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {track.artist_name} • {track.streams} plays •{" "}
                      {track.recent_7d_streams || 0} this week
                    </p>
                    <p className="text-xs text-gray-500">
                      Group score: {track.group_score}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={() =>
                  runAdminAction(`create ${playlist.name} in Spotify`, () =>
                    createTripPlaylist(playlistKey, playlist),
                  )
                }
                disabled={
                  creatingPlaylistKey === playlistKey ||
                  playlist.tracks.length === 0
                }
                className="bg-[#1db954] disabled:bg-[#2a2a2a] disabled:text-gray-500 text-black text-sm font-semibold px-3 py-2 rounded-full w-full mt-4"
              >
                {creatingPlaylistKey === playlistKey
                  ? "Creating..."
                  : "Create in Spotify"}
              </button>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

export default GroupPlaylistsSection;
