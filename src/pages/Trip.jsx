import { useMemo, useState } from "react";

import TopBar from "../components/TopBar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import ArtistPreferenceSurvey from "../components/trip/ArtistPreferenceSurvey.jsx";
import { useSpotifyContext } from "../context/SpotifyContext.jsx";

function getStoredMembers() {
  try {
    return JSON.parse(localStorage.getItem("spotify_ai_trip_members") || "[]");
  } catch {
    return [];
  }
}

function Trip() {
  const { playlists = [] } = useSpotifyContext();
  const [tripName, setTripName] = useState("Weekend trip");
  const [email, setEmail] = useState("");
  const [surveyName, setSurveyName] = useState("");
  const [surveyMemberName, setSurveyMemberName] = useState("");
  const [members, setMembers] = useState(getStoredMembers);

  const saveMembers = (nextMembers) => {
    setMembers(nextMembers);
    localStorage.setItem("spotify_ai_trip_members", JSON.stringify(nextMembers));
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
        likedArtists,
        ignoredArtists,
      },
    ]);
    setSurveyMemberName("");
  };

  const removeMember = (memberId) => {
    saveMembers(members.filter((member) => member.id !== memberId));
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
    <div className="h-screen bg-black flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar playlists={playlists} />

        <main className="flex-1 bg-[#121212] rounded-lg m-2 overflow-hidden">
          <div className="p-6 text-white overflow-y-auto h-full">
            <h1 className="text-3xl font-bold mb-2">Trip group</h1>
            <p className="text-sm text-gray-400 mb-6">
              Build a group taste profile before generating shared, bridge, and
              new discovery playlists.
            </p>

            <section className="bg-[#181818] rounded-lg p-6 mb-6">
              <label className="block text-sm text-gray-400 mb-2">
                Trip name
              </label>
              <input
                value={tripName}
                onChange={(event) => setTripName(event.target.value)}
                className="bg-[#121212] border border-white/10 rounded-lg px-4 py-3 text-white outline-none w-full max-w-xl"
              />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-[#181818] rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Add app member</h2>
                <p className="text-sm text-gray-400 mb-4">
                  First version stores a pending invite locally. Later this will
                  send a real consent link.
                </p>

                <div className="flex gap-3">
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
                  survey.
                </p>

                <div className="flex gap-3">
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
                      className="bg-[#121212] rounded-lg p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-semibold">{member.name}</p>
                        <p className="text-sm text-gray-400">
                          {member.status}
                          {member.type === "survey" &&
                            ` • ${member.likedArtists.length} liked • ${member.ignoredArtists.length} ignored`}
                        </p>
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
                Current trip playlists still use your backend data. The next
                backend step is to merge these survey profiles into group
                scoring.
              </p>
              <button
                type="button"
                className="bg-[#1db954] text-black text-sm font-semibold px-4 py-2 rounded-full"
              >
                Ready for backend group scoring
              </button>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Trip;
