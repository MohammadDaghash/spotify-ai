import { useMemo, useState } from "react";

import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import AdminGateModal from "../components/AdminGateModal.jsx";
import GroupPlaylistsSection from "../components/recommendations/GroupPlaylistsSection.jsx";
import ArtistPreferenceSurvey from "../components/trip/ArtistPreferenceSurvey.jsx";
import { useSpotifyContext } from "../context/useSpotifyContext.js";
import { getTripPlaylists } from "../services/mlApi.js";
import { isAdmin } from "../utils/adminAuth.js";
import { recordFeedbackEvent } from "../utils/feedbackEvents.js";

const HANGOUT_TYPES = [
  "Apartment hangout",
  "Picnic",
  "Road trip",
  "Party night",
  "Dinner",
  "Chill session",
  "Pre-game",
  "After-party",
  "Beach day",
  "Pool day",
  "BBQ",
  "Study session",
  "Coffee hangout",
  "Game night",
  "Workout",
  "Long drive",
  "Family gathering",
  "Date night",
  "Late-night talk",
  "House cleaning",
  "Birthday",
];

const MOODS = [
  "Chill",
  "Energetic",
  "Dance",
  "Nostalgic",
  "Background",
  "Romantic",
  "Sad",
  "Hype",
  "Sing-along",
  "Throwback",
  "Road-trip",
  "Focus",
  "Arabic classics",
  "Pop hits",
  "Hip-hop",
  "R&B",
  "Mixed",
];

const LANGUAGES = [
  "English",
  "Arabic",
  "Hebrew",
  "Spanish",
  "French",
  "Korean",
];

const ARTISTS_BY_LANGUAGE = {
  English: [
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
    "Harry Styles",
    "Bruno Mars",
    "Eminem",
    "JAY-Z",
    "Kendrick Lamar",
    "Drake",
    "Future",
    "SZA",
    "Adele",
    "Frank Ocean",
    "Travis Scott",
    "Kanye West",
    "Post Malone",
    "Nicki Minaj",
    "Doja Cat",
    "Cardi B",
    "Miley Cyrus",
    "Justin Bieber",
    "Selena Gomez",
    "Katy Perry",
    "Alicia Keys",
    "Usher",
    "Chris Brown",
    "The Neighbourhood",
    "Lana Del Rey",
    "Lorde",
    "Halsey",
    "Tate McRae",
    "Charli xcx",
    "Chappell Roan",
    "Madonna",
    "Michael Jackson",
    "Britney Spears",
    "ABBA",
    "Coldplay",
    "Imagine Dragons",
    "Maroon 5",
    "Ed Sheeran",
    "Sam Smith",
    "Ava Max",
    "A$AP Rocky",
    "21 Savage",
    "Metro Boomin",
    "Lil Wayne",
    "Tyler, The Creator",
    "Childish Gambino",
    "Daniel Caesar",
    "Giveon",
    "PARTYNEXTDOOR",
    "Summer Walker",
    "Jhene Aiko",
    "Tyla",
    "Sean Paul",
    "Calvin Harris",
    "David Guetta",
    "Avicii",
    "Swedish House Mafia",
    "Tame Impala",
    "The 1975",
    "Arctic Monkeys",
    "Cigarettes After Sex",
  ],
  Arabic: [
    "Fairuz",
    "Amr Diab",
    "Nancy Ajram",
    "Elissa",
    "Sherine",
    "Marwan Khoury",
    "Kadim Al Sahir",
    "Umm Kulthum",
    "Abdel Halim Hafez",
    "Mohammed Abdel Wahab",
    "Warda",
    "Majida El Roumi",
    "Nawal El Zoghbi",
    "Najwa Karam",
    "Ragheb Alama",
    "Wael Kfoury",
    "Fadel Chaker",
    "Assala",
    "Angham",
    "Carole Samaha",
    "Myriam Fares",
    "Haifa Wehbe",
    "Tamer Hosny",
    "Mohamed Hamaki",
    "Hussain Al Jassmi",
    "Balqees",
    "Saad Lamjarred",
    "Ziad Rahbani",
    "Mashrou' Leila",
    "Cairokee",
    "Autostrad",
    "Apo & The Apostles",
    "Massar Egbari",
    "Le Trio Joubran",
    "Elyanna",
    "Saint Levant",
    "Issam Alnajjar",
    "Sharmoofers",
    "Adonis",
    "Akher Zapheer",
    "Al Shami",
    "Abeer Nehme",
    "Julia Boutros",
    "Wegz",
    "Marwan Moussa",
    "Abyusif",
    "Shabjdeed",
    "Daboor",
    "ElGrandeToto",
    "Balti",
  ],
  Hebrew: [
    "Omer Adam",
    "Noa Kirel",
    "Eden Hason",
    "Eden Ben Zaken",
    "Static",
    "Ben El",
    "Idan Raichel",
    "Ishay Ribo",
  ],
  Spanish: [
    "Bad Bunny",
    "Rosalia",
    "Shakira",
    "Karol G",
    "J Balvin",
    "Enrique Iglesias",
    "Rauw Alejandro",
    "Becky G",
  ],
  French: [
    "Stromae",
    "Aya Nakamura",
    "Indila",
    "Angele",
    "GIMS",
    "Dadju",
    "Zaz",
  ],
  Korean: [
    "BTS",
    "BLACKPINK",
    "NewJeans",
    "TWICE",
    "Stray Kids",
    "IVE",
    "LE SSERAFIM",
  ],
};

const ARTISTS_BY_MOOD = {
  Chill: [
    "Lana Del Rey",
    "Adele",
    "Lorde",
    "Frank Ocean",
    "SZA",
    "Fairuz",
    "Cigarettes After Sex",
    "Daniel Caesar",
  ],
  Energetic: [
    "Dua Lipa",
    "Tate McRae",
    "Rihanna",
    "Doja Cat",
    "Sean Paul",
    "Bruno Mars",
    "Calvin Harris",
  ],
  Dance: [
    "Lady Gaga",
    "Charli xcx",
    "Madonna",
    "Calvin Harris",
    "Bad Bunny",
    "David Guetta",
    "Beyonce",
  ],
  Nostalgic: [
    "Michael Jackson",
    "Britney Spears",
    "ABBA",
    "Madonna",
    "Adele",
    "Umm Kulthum",
    "Abdel Halim Hafez",
  ],
  Background: [
    "Norah Jones",
    "Sade",
    "The xx",
    "Cigarettes After Sex",
    "Fairuz",
    "Ziad Rahbani",
  ],
  Romantic: [
    "Adele",
    "Bruno Mars",
    "Daniel Caesar",
    "Elissa",
    "Wael Kfoury",
    "Marwan Khoury",
  ],
  Sad: [
    "Billie Eilish",
    "Lana Del Rey",
    "Adele",
    "Sherine",
    "Elissa",
    "Frank Ocean",
  ],
  Hype: [
    "Eminem",
    "JAY-Z",
    "Kendrick Lamar",
    "Drake",
    "Future",
    "Travis Scott",
    "Wegz",
    "Marwan Moussa",
  ],
  "Sing-along": [
    "Taylor Swift",
    "Ariana Grande",
    "Bruno Mars",
    "Amr Diab",
    "Nancy Ajram",
    "Rihanna",
  ],
  Throwback: [
    "Michael Jackson",
    "Britney Spears",
    "Madonna",
    "ABBA",
    "Umm Kulthum",
    "Fairuz",
  ],
  "Road-trip": [
    "Coldplay",
    "The Weeknd",
    "Dua Lipa",
    "Amr Diab",
    "Sean Paul",
    "Post Malone",
  ],
  Focus: [
    "Tame Impala",
    "The 1975",
    "Frank Ocean",
    "Fairuz",
    "Le Trio Joubran",
    "Sade",
  ],
  "Arabic classics": [
    "Fairuz",
    "Umm Kulthum",
    "Abdel Halim Hafez",
    "Warda",
    "Kadim Al Sahir",
    "Majida El Roumi",
  ],
  "Pop hits": [
    "Taylor Swift",
    "Dua Lipa",
    "Ariana Grande",
    "Beyonce",
    "Rihanna",
    "Sabrina Carpenter",
  ],
  "Hip-hop": [
    "Eminem",
    "JAY-Z",
    "Kendrick Lamar",
    "Drake",
    "Future",
    "Travis Scott",
    "21 Savage",
  ],
  "R&B": [
    "SZA",
    "Frank Ocean",
    "Beyonce",
    "Usher",
    "Alicia Keys",
    "Summer Walker",
    "Daniel Caesar",
  ],
  Mixed: [
    "Taylor Swift",
    "The Weeknd",
    "Beyonce",
    "Ariana Grande",
    "Drake",
    "Amr Diab",
    "Fairuz",
  ],
};

function getStoredMembers() {
  try {
    return JSON.parse(
      localStorage.getItem("spotify_ai_group_members") ||
        localStorage.getItem("spotify_ai_trip_members") ||
        "[]",
    );
  } catch {
    return [];
  }
}

function getMoodLabels(context = {}) {
  if (Array.isArray(context.moods) && context.moods.length > 0) {
    return context.moods;
  }

  return context.mood ? [context.mood] : [];
}

function getUniqueMemberArtists(members, fieldName) {
  return [
    ...new Set(
      members.flatMap((member) =>
        Array.isArray(member?.[fieldName]) ? member[fieldName] : [],
      ),
    ),
  ];
}

function Trip() {
  const { playlists = [], createPrivatePlaylistFromTracks } = useSpotifyContext();
  const [groupName, setGroupName] = useState("Saturday hangout");
  const [hangoutType, setHangoutType] = useState("Apartment hangout");
  const [moods, setMoods] = useState(["Mixed"]);
  const [languages, setLanguages] = useState(["English"]);
  const [email, setEmail] = useState("");
  const [surveyName, setSurveyName] = useState("");
  const [surveyMemberName, setSurveyMemberName] = useState("");
  const [members, setMembers] = useState(getStoredMembers);
  const [groupPlaylists, setGroupPlaylists] = useState(null);
  const [groupMixLoading, setGroupMixLoading] = useState(false);
  const [groupMixError, setGroupMixError] = useState("");
  const [creatingPlaylistKey, setCreatingPlaylistKey] = useState("");
  const [adminGate, setAdminGate] = useState({
    isOpen: false,
    actionLabel: "",
    action: null,
  });

  const saveMembers = (nextMembers) => {
    setMembers(nextMembers);
    localStorage.setItem("spotify_ai_group_members", JSON.stringify(nextMembers));
  };

  const surveyArtistPool = useMemo(() => {
    const languageArtists = languages.flatMap(
      (language) => ARTISTS_BY_LANGUAGE[language] || [],
    );
    const moodArtists = moods.flatMap((item) => ARTISTS_BY_MOOD[item] || []);

    return [...new Set([...languageArtists, ...moodArtists])];
  }, [languages, moods]);

  const surveyLikedArtists = useMemo(
    () => getUniqueMemberArtists(members, "likedArtists"),
    [members],
  );

  const surveyIgnoredArtists = useMemo(
    () => getUniqueMemberArtists(members, "ignoredArtists"),
    [members],
  );

  const hasGroupPlaylistTracks = useMemo(
    () =>
      Boolean(
        groupPlaylists &&
          Object.values(groupPlaylists).some(
            (playlist) => playlist?.tracks?.length > 0,
          ),
      ),
    [groupPlaylists],
  );

  const toggleMood = (selectedMood) => {
    setMoods((prev) => {
      if (selectedMood === "Mixed") {
        return ["Mixed"];
      }

      const withoutMixed = prev.filter((item) => item !== "Mixed");

      if (withoutMixed.includes(selectedMood)) {
        const next = withoutMixed.filter((item) => item !== selectedMood);
        return next.length > 0 ? next : ["Mixed"];
      }

      return [...withoutMixed, selectedMood];
    });
  };

  const toggleLanguage = (language) => {
    setLanguages((prev) => {
      if (prev.includes(language)) {
        const next = prev.filter((item) => item !== language);
        return next.length > 0 ? next : prev;
      }

      return [...prev, language];
    });
  };

  const addEmailMember = () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    saveMembers([
      ...members,
      {
        id: crypto.randomUUID(),
        type: "invite",
        name: cleanEmail,
        email: cleanEmail,
        status: "Pending invite",
        context: {
          groupName,
          hangoutType,
          moods,
          languages,
        },
        likedArtists: [],
        ignoredArtists: [],
      },
    ]);
    setEmail("");
  };

  const startSurvey = () => {
    const cleanName = surveyName.trim();
    if (!cleanName) return;
    setSurveyMemberName(cleanName);
    setSurveyName("");
  };

  const saveSurveyMember = ({ likedArtists, ignoredArtists }) => {
    saveMembers([
      ...members,
      {
        id: crypto.randomUUID(),
        type: "survey",
        name: surveyMemberName,
        status: "Survey complete",
        context: {
          groupName,
          hangoutType,
          moods,
          languages,
        },
        likedArtists,
        ignoredArtists,
      },
    ]);
    setSurveyMemberName("");
  };

  const removeMember = (memberId) => {
    saveMembers(members.filter((member) => member.id !== memberId));
  };

  const runAdminAction = (actionLabel, action) => {
    if (isAdmin()) {
      action();
      return;
    }

    setAdminGate({
      isOpen: true,
      actionLabel,
      action,
    });
  };

  const closeAdminGate = () => {
    setAdminGate({
      isOpen: false,
      actionLabel: "",
      action: null,
    });
  };

  const approveAdminGate = () => {
    adminGate.action?.();
    closeAdminGate();
  };

  const generateGroupPlaylists = async () => {
    try {
      setGroupMixLoading(true);
      setGroupMixError("");

      const data = await getTripPlaylists({
        limit: 25,
        newSongMaxPlays: 5,
        groupMembers: members,
        surveyLikedArtists,
        surveyIgnoredArtists,
        contextArtists: surveyArtistPool,
        hangoutType,
        moods,
        languages,
      });

      setGroupPlaylists(data.playlists || null);
    } catch (error) {
      console.error(error);
      setGroupMixError(
        "Could not generate group playlists. Check the backend or try again.",
      );
    } finally {
      setGroupMixLoading(false);
    }
  };

  const createTripPlaylist = async (playlistKey, playlist) => {
    const spotifyWindow = window.open("", "_blank", "noreferrer");

    if (spotifyWindow) {
      spotifyWindow.document.write(
        "<p style='font-family: system-ui; padding: 24px;'>Creating Spotify playlist...</p>",
      );
    }

    try {
      setCreatingPlaylistKey(playlistKey);
      setGroupMixError("");

      const spotifyUrl = await createPrivatePlaylistFromTracks?.({
        name: playlist.name,
        description: playlist.description,
        tracks: playlist.tracks,
      });

      if (spotifyUrl) {
        recordFeedbackEvent({
          action: "create_playlist",
          itemType: "group_playlist",
          item: playlist,
          mode: isAdmin() ? "admin-demo" : "public-demo",
          source: "group-mix",
          context: {
            route: "/group-mix",
            groupName,
            hangoutType,
            moods,
            languages,
            playlistKey,
            trackCount: playlist.tracks.length,
          },
        });

        if (spotifyWindow) {
          spotifyWindow.location.href = spotifyUrl;
        } else {
          window.location.assign(spotifyUrl);
        }
      } else {
        spotifyWindow?.close();
        setGroupMixError(
          "Spotify created the playlist but did not return a URL.",
        );
      }
    } catch (error) {
      console.error(error);
      spotifyWindow?.close();
      setGroupMixError("Could not create Spotify playlist. Try logging in again.");
    } finally {
      setCreatingPlaylistKey("");
    }
  };

  const surveyMembers = useMemo(
    () => members.filter((member) => member.type === "survey"),
    [members],
  );

  const inviteMembers = useMemo(
    () => members.filter((member) => member.type === "invite"),
    [members],
  );

  return (
    <div className="app-shell h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar playlists={playlists} />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="fade-in p-6 text-white overflow-y-auto h-full">
            <div className="premium-hero mb-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#1db954]">
                Shared listening
              </p>
              <h1 className="page-title text-4xl font-bold md:text-5xl">
                Group Mix
              </h1>
              <p className="page-subtitle mt-3 max-w-4xl text-sm leading-relaxed md:text-base">
                Build a group taste profile for any hangout: apartment night,
                picnic, party, road trip, dinner, or anything in between.
              </p>
            </div>

            <section className="bg-[#181818] rounded-lg p-6 mb-6">
              <label className="block text-sm text-gray-400 mb-2">
                Group mix name
              </label>
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                className="bg-[#121212] border border-white/10 rounded-lg px-4 py-3 text-white outline-none w-full max-w-xl"
              />
            </section>

            <section className="bg-[#181818] rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Hangout context</h2>

              <div className="mb-5">
                <p className="text-sm text-gray-400 mb-3">
                  What kind of hangout is this?
                </p>
                <div className="flex flex-wrap gap-2">
                  {HANGOUT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setHangoutType(type)}
                      className={`text-sm px-3 py-2 rounded-full ${
                        hangoutType === type
                          ? "bg-white text-black font-semibold"
                          : "bg-[#2a2a2a] text-white"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-sm text-gray-400 mb-3">Moods</p>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleMood(item)}
                      className={`text-sm px-3 py-2 rounded-full ${
                        moods.includes(item)
                          ? "bg-white text-black font-semibold"
                          : "bg-[#2a2a2a] text-white"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-3">
                  Preferred languages
                </p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => toggleLanguage(language)}
                      className={`text-sm px-3 py-2 rounded-full ${
                        languages.includes(language)
                          ? "bg-[#1db954] text-black font-semibold"
                          : "bg-[#2a2a2a] text-white"
                      }`}
                    >
                      {language}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-[#181818] rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Add app member</h2>
                <p className="text-sm text-gray-400 mb-4">
                  First version stores a pending invite locally. Later this will
                  send a real consent link.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="friend@email.com"
                    className="bg-[#121212] border border-white/10 rounded-lg px-4 py-3 text-white outline-none flex-1"
                  />
                  <button
                    type="button"
                    onClick={addEmailMember}
                    className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-full"
                  >
                    Add email
                  </button>
                </div>
              </div>

              <div className="bg-[#181818] rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Add survey member</h2>
                <p className="text-sm text-gray-400 mb-4">
                  For someone without the app, use a fast artist like/ignore
                  survey shaped by the hangout context.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={surveyName}
                    onChange={(event) => setSurveyName(event.target.value)}
                    placeholder="Friend name"
                    className="bg-[#121212] border border-white/10 rounded-lg px-4 py-3 text-white outline-none flex-1"
                  />
                  <button
                    type="button"
                    onClick={startSurvey}
                    className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-full"
                  >
                    Start survey
                  </button>
                </div>
              </div>
            </section>

            {surveyMemberName && (
              <section className="mb-6">
                <ArtistPreferenceSurvey
                  memberName={surveyMemberName}
                  artistPool={surveyArtistPool}
                  context={{
                    hangoutType,
                    moods,
                    languages,
                  }}
                  onSave={saveSurveyMember}
                  onCancel={() => setSurveyMemberName("")}
                />
              </section>
            )}

            <section className="bg-[#181818] rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold">Members</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {members.length} total • {surveyMembers.length} survey •{" "}
                    {inviteMembers.length} pending invites
                  </p>
                </div>
              </div>

              {members.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Add at least one member to start building a group profile.
                </p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="music-table-row bg-[#121212] rounded-lg p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-sm text-gray-400">
                          {member.status}
                          {member.type === "survey" &&
                            ` • ${member.likedArtists.length} liked • ${member.ignoredArtists.length} ignored`}
                        </p>
                        {member.context && (
                          <p className="text-xs text-gray-500 mt-1">
                            {member.context.hangoutType} •{" "}
                            {getMoodLabels(member.context).join(", ")} •{" "}
                            {member.context.languages.join(", ")}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="bg-[#2a2a2a] text-white text-sm px-3 py-1.5 rounded-full"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-[#181818] rounded-lg p-6">
              <h2 className="text-xl font-bold mb-2">Generate playlists</h2>
              <p className="text-sm text-gray-400 mb-4">
                Uses the listening base data, selected hangout context, and each
                survey member's liked/ignored artists to build three playlist
                strategies.
              </p>
              <button
                type="button"
                onClick={generateGroupPlaylists}
                disabled={groupMixLoading}
                className="bg-[#1db954] text-black text-sm font-semibold px-4 py-2 rounded-full"
              >
                {groupMixLoading ? "Generating..." : "Generate group playlists"}
              </button>

              {groupMixError && (
                <p className="text-sm text-red-400 mt-4">{groupMixError}</p>
              )}

              {groupPlaylists && !hasGroupPlaylistTracks && (
                <p className="text-sm text-gray-400 mt-4">
                  No playlist tracks matched this context yet. Add more survey
                  answers or try a broader mood/language mix.
                </p>
              )}
            </section>

            <GroupPlaylistsSection
              createTripPlaylist={createTripPlaylist}
              creatingPlaylistKey={creatingPlaylistKey}
              displayedTripPlaylists={groupPlaylists}
              hasDisplayedTripPlaylistTracks={hasGroupPlaylistTracks}
              runAdminAction={runAdminAction}
            />

            <AdminGateModal
              actionLabel={adminGate.actionLabel}
              isOpen={adminGate.isOpen}
              message="Admin login required for creating Spotify playlists from the public demo data."
              onApproved={approveAdminGate}
              onClose={closeAdminGate}
              title="Admin login required"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Trip;
