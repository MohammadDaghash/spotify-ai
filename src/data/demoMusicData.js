export const monthlyTopSongs = [
  {
    month: "2025-01",
    rank: 1,
    trackName: "Blinding Lights",
    artistName: "The Weeknd",
    albumName: "After Hours",
    streams: 42,
    minutesPlayed: 210,
  },
  {
    month: "2025-01",
    rank: 2,
    trackName: "bad guy",
    artistName: "Billie Eilish",
    albumName: "WHEN WE ALL FALL ASLEEP",
    streams: 35,
    minutesPlayed: 142,
  },
  {
    month: "2025-01",
    rank: 3,
    trackName: "Cruel Summer",
    artistName: "Taylor Swift",
    albumName: "Lover",
    streams: 31,
    minutesPlayed: 118,
  },
];

export const monthlyTopArtists = [
  {
    month: "2025-01",
    rank: 1,
    artistName: "The Weeknd",
    streams: 86,
    songsInLibrary: 14,
  },
  {
    month: "2025-01",
    rank: 2,
    artistName: "Billie Eilish",
    streams: 74,
    songsInLibrary: 11,
  },
  {
    month: "2025-01",
    rank: 3,
    artistName: "Taylor Swift",
    streams: 68,
    songsInLibrary: 19,
  },
];

export const monthlyTopAlbums = [
  {
    month: "2025-01",
    rank: 1,
    albumName: "After Hours",
    artistName: "The Weeknd",
    streams: 51,
  },
  {
    month: "2025-01",
    rank: 2,
    albumName: "HIT ME HARD AND SOFT",
    artistName: "Billie Eilish",
    streams: 44,
  },
  {
    month: "2025-01",
    rank: 3,
    albumName: "Lover",
    artistName: "Taylor Swift",
    streams: 39,
  },
];

export const libraryArtists = [
  { artistName: "The Weeknd", songsInLibrary: 14 },
  { artistName: "Billie Eilish", songsInLibrary: 11 },
  { artistName: "Taylor Swift", songsInLibrary: 19 },
  { artistName: "Lana Del Rey", songsInLibrary: 9 },
];

export const aiRecommendations = [
  {
    trackName: "Less Than Zero",
    artistName: "The Weeknd",
    score: 0.91,
    reason:
      "High match with your synth-pop and emotional-pop listening pattern.",
    alreadyInLibrary: false,
  },
  {
    trackName: "CHIHIRO",
    artistName: "Billie Eilish",
    score: 0.87,
    reason:
      "Recommended because your history leans toward dark pop and atmospheric vocals.",
    alreadyInLibrary: false,
  },
];

export const demoUserProfile = {
  favoriteArtists: ["The Weeknd", "Billie Eilish", "Taylor Swift"],
  favoriteGenres: ["pop", "synth-pop", "dark pop", "electropop"],
  favoriteMoods: ["emotional", "atmospheric", "energetic"],
  knownTracks: ["Blinding Lights", "bad guy", "Cruel Summer"],
};

export const candidateTracks = [
  {
    trackName: "Less Than Zero",
    artistName: "The Weeknd",
    genres: ["pop", "synth-pop"],
    moods: ["emotional", "energetic"],
    popularity: 0.82,
    recencyScore: 0.55,
  },
  {
    trackName: "CHIHIRO",
    artistName: "Billie Eilish",
    genres: ["dark pop", "electropop"],
    moods: ["atmospheric", "emotional"],
    popularity: 0.88,
    recencyScore: 0.95,
  },
  {
    trackName: "Espresso",
    artistName: "Sabrina Carpenter",
    genres: ["pop"],
    moods: ["energetic"],
    popularity: 0.91,
    recencyScore: 0.9,
  },
  {
    trackName: "Blinding Lights",
    artistName: "The Weeknd",
    genres: ["pop", "synth-pop"],
    moods: ["energetic"],
    popularity: 0.95,
    recencyScore: 0.4,
  },
];
