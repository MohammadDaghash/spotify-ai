import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
});

const fetchTopSongsBySinger = ( async (singer) => {
  const res = await api.post("/api/songs", { singer });
  return res.data.songs
});



export { fetchTopSongsBySinger };
