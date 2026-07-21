import RankMovementBadge from "../RankMovementBadge.jsx";
import {
  getSpotifySearchUrl,
  getTrackHistoryKey,
} from "../../utils/recommendationPageUtils.js";
import ModelBreakdown from "./ModelBreakdown.jsx";

function RecommendedSongsSection({
  applyTrackFeedback,
  isSearchActive,
  onOpenSpotify,
  runAdminAction,
  saveSongRecommendation,
  savedSongs,
  songs,
}) {
  return (
    <>
      <h2 className="text-xl font-bold mb-4">Recommended songs</h2>

      {songs.length === 0 && (
        <p className="mb-4 text-sm text-gray-400">
          {isSearchActive ? "No results found" : "No new song recommendations found."}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {songs.map((rec) => (
          <div
            key={`${rec.trackName}-${rec.artistName}`}
            className="bg-[#181818] rounded-lg p-5 hover:bg-[#252525] transition"
          >
            <div className="flex justify-between gap-4">
              <div>
                <h3 className="font-bold flex items-center gap-2">
                  <span>#{rec.rank}</span>
                  <RankMovementBadge row={rec} />
                  <span>{rec.trackName}</span>
                </h3>
                <p className="text-sm text-gray-400">{rec.artistName}</p>
              </div>

              <span className="text-sm font-bold">{rec.relativeMatch}%</span>
            </div>

            <p className="text-sm text-gray-300 mt-3">{rec.reason}</p>

            <ModelBreakdown
              signals={[
                { label: "Model score", value: rec.score },
                {
                  label: "ML p(like)",
                  value: rec.mlLikeProbability,
                  tone: "blue",
                },
                {
                  label: "Base score",
                  value: rec.heuristicScore,
                  tone: "amber",
                },
                {
                  label: "Similarity",
                  value: rec.similarityScore,
                  tone: "blue",
                },
                { label: "Quality", value: rec.qualityScore },
                {
                  label: "Confidence",
                  value: rec.confidence,
                  tone: "amber",
                },
                {
                  label: "Recency",
                  value: rec.recencyScore,
                  tone: "blue",
                },
                {
                  label: "Known penalty",
                  value: rec.knownTrackPenalty,
                  tone: "red",
                },
                {
                  label: "Diversity penalty",
                  value: rec.diversityPenalty,
                  tone: "red",
                },
                ...(rec.feedbackScoreDelta
                  ? [
                      {
                        label: "Feedback",
                        value: rec.feedbackScoreDelta,
                        tone: rec.feedbackScoreDelta < 0 ? "red" : "green",
                      },
                    ]
                  : []),
              ]}
            />

            <p className="text-xs text-gray-500 mt-3">
              Played {rec.historyPlayCount} times in your exported history
              {rec.recentListenStrength !== undefined
                ? ` • Recent strength: ${rec.recentListenStrength}`
                : ""}
              {rec.rawSimilarityScore !== undefined
                ? ` • Raw cosine: ${rec.rawSimilarityScore}`
                : ""}
            </p>

            <div className="flex gap-2 mt-4">
              <a
                href={getSpotifySearchUrl(`${rec.trackName} ${rec.artistName}`)}
                target="_blank"
                rel="noreferrer"
                onClick={() => onOpenSpotify?.(rec)}
                className="bg-[#1db954] text-black text-sm font-semibold px-3 py-1.5 rounded-full"
              >
                Open Spotify
              </a>

              <button
                onClick={() =>
                  runAdminAction(`save ${rec.trackName}`, () =>
                    saveSongRecommendation(rec),
                  )
                }
                disabled={savedSongs.includes(
                  getTrackHistoryKey(rec.trackName, rec.artistName),
                )}
                className="bg-[#3b82f6] disabled:bg-[#2a2a2a] disabled:text-gray-500 text-white text-sm font-semibold px-3 py-1.5 rounded-full"
              >
                {savedSongs.includes(
                  getTrackHistoryKey(rec.trackName, rec.artistName),
                )
                  ? "Saved"
                  : "Save"}
              </button>

              <button
                onClick={() =>
                  runAdminAction(`mark ${rec.trackName} as liked`, () =>
                    applyTrackFeedback(rec, "like"),
                  )
                }
                className="bg-white text-black text-sm font-semibold px-3 py-1.5 rounded-full"
              >
                Liked
              </button>

              <button
                onClick={() =>
                  runAdminAction(`ignore ${rec.trackName}`, () =>
                    applyTrackFeedback(rec, "ignore"),
                  )
                }
                className="bg-[#2a2a2a] text-white text-sm px-3 py-1.5 rounded-full"
              >
                Ignore
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default RecommendedSongsSection;
