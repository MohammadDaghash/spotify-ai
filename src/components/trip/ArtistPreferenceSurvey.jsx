import { useMemo, useState } from "react";

const DEFAULT_ARTISTS = [
  "Taylor Swift",
  "Billie Eilish",
  "Lady Gaga",
  "Ariana Grande",
  "Beyonce",
  "Dua Lipa",
  "Rihanna",
  "The Weeknd",
  "Sabrina Carpenter",
  "Olivia Rodrigo",
  "Charli xcx",
  "Lana Del Rey",
  "Tate McRae",
  "Halsey",
  "Harry Styles",
  "Doja Cat",
  "Madonna",
  "Michael Jackson",
  "Fairuz",
  "Justin Bieber",
  "Destiny's Child",
  "Sean Paul",
  "Lorde",
  "Tame Impala",
  "The 1975",
  "Adele",
  "Eminem",
  "Britney Spears",
  "Chappell Roan",
  "Miley Cyrus",
];

function ArtistPreferenceSurvey({
  memberName,
  artistPool = DEFAULT_ARTISTS,
  context = {},
  minimumChoices = 5,
  onSave,
  onCancel,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedArtists, setLikedArtists] = useState([]);
  const [ignoredArtists, setIgnoredArtists] = useState([]);

  const availableArtists = useMemo(() => {
    const alreadySeen = new Set([...likedArtists, ...ignoredArtists]);
    return artistPool.filter((artist) => !alreadySeen.has(artist));
  }, [artistPool, likedArtists, ignoredArtists]);

  const currentArtist = availableArtists[currentIndex] || availableArtists[0];
  const choicesCount = likedArtists.length + ignoredArtists.length;
  const canSave = choicesCount >= minimumChoices;
  const contextMoods =
    Array.isArray(context.moods) && context.moods.length > 0
      ? context.moods
      : context.mood
        ? [context.mood]
        : [];

  const recordChoice = (artist, sentiment) => {
    if (!artist) return;

    if (sentiment === "like") {
      setLikedArtists((prev) => [...new Set([...prev, artist])]);
    } else {
      setIgnoredArtists((prev) => [...new Set([...prev, artist])]);
    }

    setCurrentIndex(0);
  };

  return (
    <div className="bg-[#181818] rounded-lg p-6 border border-white/10">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold">Artist preference survey</h2>
          <p className="text-sm text-gray-400 mt-1">
            {memberName || "Survey member"} picked {choicesCount}. Minimum{" "}
            {minimumChoices} required.
          </p>
          {(context.hangoutType || contextMoods.length || context.languages?.length) && (
            <p className="text-xs text-gray-500 mt-2">
              {[
                context.hangoutType,
                ...contextMoods,
                ...(context.languages || []),
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="bg-[#2a2a2a] text-white text-sm px-3 py-1.5 rounded-full"
        >
          Cancel
        </button>
      </div>

      {currentArtist ? (
        <div className="bg-[#121212] rounded-lg p-6">
          <p className="text-sm text-gray-400 mb-2">Do they like this artist?</p>
          <h3 className="page-title text-4xl font-bold">{currentArtist}</h3>
          <p className="text-xs text-gray-500 mt-2">
            Suggested from the selected group context.
          </p>

          <div className="flex flex-col gap-3 mt-6 sm:flex-row">
            <button
              type="button"
              onClick={() => recordChoice(currentArtist, "like")}
              className="bg-white text-black text-sm font-semibold px-5 py-2 rounded-full"
            >
              Like
            </button>

            <button
              type="button"
              onClick={() => recordChoice(currentArtist, "ignore")}
              className="bg-[#2a2a2a] text-white text-sm px-5 py-2 rounded-full"
            >
              Ignore
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#121212] rounded-lg p-6">
          <p className="text-sm text-gray-400">
            No more artists in this survey pool.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div>
          <p className="text-sm font-semibold mb-2">
            Liked artists ({likedArtists.length})
          </p>
          <div className="text-sm text-gray-400 space-y-1">
            {likedArtists.length === 0 && <p>None yet</p>}
            {likedArtists.map((artist) => (
              <p key={artist}>{artist}</p>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">
            Ignored artists ({ignoredArtists.length})
          </p>
          <div className="text-sm text-gray-400 space-y-1">
            {ignoredArtists.length === 0 && <p>None yet</p>}
            {ignoredArtists.map((artist) => (
              <p key={artist}>{artist}</p>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!canSave}
        onClick={() =>
          onSave({
            likedArtists,
            ignoredArtists,
          })
        }
        className="bg-[#1db954] disabled:bg-[#2a2a2a] disabled:text-gray-500 text-black text-sm font-semibold px-4 py-2 rounded-full mt-6"
      >
        {canSave ? "Save survey member" : `Choose ${minimumChoices - choicesCount} more`}
      </button>
    </div>
  );
}

export default ArtistPreferenceSurvey;
