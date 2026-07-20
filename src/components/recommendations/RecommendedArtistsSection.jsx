import RankMovementBadge from "../RankMovementBadge.jsx";
import {
  getSpotifySearchUrl,
} from "../../utils/recommendationPageUtils.js";
import ModelBreakdown from "./ModelBreakdown.jsx";

function RecommendedArtistsSection({
  applyArtistFeedback,
  artists,
  isSearchActive,
  mlError,
  mlLoading,
  onOpenSpotify,
  runAdminAction,
  saveArtistRecommendation,
  savedArtists,
}) {
  return (
    <section className="bg-[#181818] rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">Recommended Artists</h2>

      {mlLoading && (
        <p className="text-sm text-gray-400">
          Loading ML artist recommendations...
        </p>
      )}

      {mlError && <p className="text-sm text-red-400">Backend error: {mlError}</p>}

      {!mlLoading && !mlError && artists.length === 0 && (
        <p className="text-sm text-gray-400">
          {isSearchActive ? "No results found" : "No new artist recommendations found."}
        </p>
      )}

      <div className="space-y-3">
        {artists.map((artist, index) => (
          <div
            key={artist.artist}
            className="music-table-row flex items-center justify-between gap-4 border-b border-white/10 p-3"
          >
            <div>
              <p className="font-semibold">
                <span className="inline-flex items-center gap-2">
                  <span>#{index + 1}</span>
                  <RankMovementBadge row={artist} />
                  <span>{artist.artist}</span>
                </span>
              </p>

              <p className="text-sm text-gray-400">
                Relative match: {artist.relativeMatch}%
              </p>

              <ModelBreakdown
                signals={[
                  { label: "Model score", value: artist.score },
                  {
                    label: "Similarity",
                    value: artist.similarity_score,
                    tone: "blue",
                  },
                  { label: "Quality", value: artist.quality_score },
                  {
                    label: "Confidence",
                    value: artist.confidence,
                    tone: "amber",
                  },
                  {
                    label: "Recency",
                    value: artist.recency_score,
                    tone: "blue",
                  },
                  {
                    label: "Known penalty",
                    value: artist.known_artist_penalty,
                    tone: "red",
                  },
                  ...(artist.feedbackScoreDelta
                    ? [
                        {
                          label: "Feedback",
                          value: artist.feedbackScoreDelta,
                          tone: artist.feedbackScoreDelta < 0 ? "red" : "green",
                        },
                      ]
                    : []),
                ]}
              />

              {artist.raw_similarity_score !== undefined && (
                <p className="text-xs text-gray-600 mt-2">
                  Raw cosine: {artist.raw_similarity_score}
                </p>
              )}

              <p className="text-sm text-gray-500">{artist.reason}</p>
            </div>

            <div className="text-right text-sm text-gray-400">
              <p>{artist.streams.toLocaleString()} streams</p>
              <p>{artist.minutes.toLocaleString()} min</p>
              <p>{Math.round(artist.skip_rate * 100)}% skip rate</p>

              <div className="flex flex-wrap justify-end gap-2 mt-3">
                <a
                  href={getSpotifySearchUrl(artist.artist)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onOpenSpotify?.(artist)}
                  className="bg-[#1db954] text-black text-xs font-semibold px-3 py-1.5 rounded-full"
                >
                  Open Spotify
                </a>

                <button
                  onClick={() =>
                    runAdminAction(`save ${artist.artist}`, () =>
                      saveArtistRecommendation(artist),
                    )
                  }
                  disabled={savedArtists.includes(artist.artist)}
                  className="bg-[#3b82f6] disabled:bg-[#2a2a2a] disabled:text-gray-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full"
                >
                  {savedArtists.includes(artist.artist) ? "Saved" : "Save"}
                </button>

                <button
                  onClick={() =>
                    runAdminAction(`mark ${artist.artist} as liked`, () =>
                      applyArtistFeedback(artist, "like"),
                    )
                  }
                  className="bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-full"
                >
                  Liked
                </button>

                <button
                  onClick={() =>
                    runAdminAction(`ignore ${artist.artist}`, () =>
                      applyArtistFeedback(artist, "ignore"),
                    )
                  }
                  className="bg-[#2a2a2a] text-white text-xs px-3 py-1.5 rounded-full"
                >
                  Ignore
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default RecommendedArtistsSection;
