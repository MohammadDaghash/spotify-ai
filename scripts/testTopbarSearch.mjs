import assert from "node:assert/strict";

import {
  buildTopbarSearchEntries,
  groupTopbarSearchResults,
  searchTopbarCatalog,
} from "../src/utils/topbarSearch.js";

const entries = buildTopbarSearchEntries({
  historyRows: [
    {
      ts: "2026-06-20T10:00:00.000Z",
      master_metadata_track_name: "Birds of a Feather",
      master_metadata_album_artist_name: "Billie Eilish",
      master_metadata_album_album_name: "HIT ME HARD AND SOFT",
      streams: 4,
      total_ms_played: 720_000,
    },
    {
      ts: "2026-06-21T10:00:00.000Z",
      master_metadata_track_name: "Espresso",
      master_metadata_album_artist_name: "Sabrina Carpenter",
      master_metadata_album_album_name: "Short n' Sweet",
      streams: 2,
      total_ms_played: 360_000,
    },
  ],
  artistRecommendations: [
    {
      artist: "Halsey",
      reason: "Similar listening pattern",
    },
  ],
  trackRecommendations: [
    {
      track_name: "Good Luck, Babe!",
      artist_name: "Chappell Roan",
      reason: "High discovery score",
    },
  ],
  groupPlaylists: {
    shared: {
      name: "Shared songs",
      tracks: [
        {
          track_name: "Training Season",
          artist_name: "Dua Lipa",
        },
      ],
    },
  },
});

assert.ok(entries.some((entry) => entry.type === "song"));
assert.ok(entries.some((entry) => entry.type === "artist"));
assert.ok(entries.some((entry) => entry.type === "album"));
assert.ok(entries.some((entry) => entry.type === "recommendation"));

const billieResults = searchTopbarCatalog("billie", entries);
assert.equal(billieResults[0].type, "artist");
assert.equal(billieResults[0].title, "Billie Eilish");
assert.equal(billieResults[0].href, "/dashboard?search=Billie+Eilish&type=artist");

const songResults = searchTopbarCatalog("birds feather", entries);
assert.equal(songResults[0].type, "song");
assert.equal(songResults[0].title, "Birds of a Feather");
assert.equal(
  songResults[0].href,
  "/dashboard?search=Birds+of+a+Feather&type=song",
);

const recommendationResults = searchTopbarCatalog("good luck", entries);
assert.equal(recommendationResults[0].type, "recommendation");
assert.equal(recommendationResults[0].href, "/recommendations?search=Good+Luck%2C+Babe%21");

assert.deepEqual(searchTopbarCatalog("", entries), []);
assert.deepEqual(searchTopbarCatalog("not-a-real-result", entries), []);

const grouped = groupTopbarSearchResults(searchTopbarCatalog("season", entries));
assert.equal(grouped[0].label, "Recommendations");
assert.equal(grouped[0].items[0].title, "Training Season");

console.log("Topbar search tests passed");
